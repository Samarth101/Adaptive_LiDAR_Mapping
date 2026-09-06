import time
from typing import Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from backend.models.base import BaseSegmentationModel, ModelPrediction

# ==============================================================================
# 1. ARCHITECTURE: POINTNET++ MODULES (Inlined from sih_pointnet2/train.py)
# ==============================================================================

def square_distance(src, dst):
    """Calculates squared Euclidean distance between every pair of points."""
    B, N, _ = src.shape
    _, M, _ = dst.shape
    dist = -2 * torch.matmul(src, dst.permute(0, 2, 1))
    dist += torch.sum(src ** 2, -1).view(B, N, 1)
    dist += torch.sum(dst ** 2, -1).view(B, 1, M)
    return dist

def farthest_point_sample(xyz, npoint):
    """Farthest Point Sampling (FPS) algorithm."""
    device = xyz.device
    B, N, C = xyz.shape
    centroids = torch.zeros(B, npoint, dtype=torch.long, device=device)
    distance = torch.ones(B, N, device=device) * 1e10
    farthest = torch.randint(0, N, (B,), dtype=torch.long, device=device)
    batch_indices = torch.arange(B, dtype=torch.long, device=device)
    for i in range(npoint):
        centroids[:, i] = farthest
        centroid = xyz[batch_indices, farthest, :].view(B, 1, 3)
        dist = torch.sum((xyz - centroid) ** 2, -1)
        mask = dist < distance
        distance[mask] = dist[mask]
        farthest = torch.max(distance, -1)[1]
    return centroids

def query_ball_point(radius, nsample, xyz, new_xyz):
    """Gathers local neighborhood indices within a ball radius."""
    device = xyz.device
    B, N, C = xyz.shape
    _, S, _ = new_xyz.shape
    group_idx = torch.arange(N, dtype=torch.long, device=device).view(1, 1, N).repeat([B, S, 1])
    sqrdists = square_distance(new_xyz, xyz)
    group_idx[sqrdists > radius ** 2] = N
    group_idx = group_idx.sort(dim=-1)[0][:, :, :nsample]
    group_first = group_idx[:, :, 0].view(B, S, 1).repeat([1, 1, nsample])
    mask = group_idx == N
    group_idx[mask] = group_first[mask]
    return group_idx

def index_points(points, idx):
    """Extracts indexed points from tensor."""
    device = points.device
    B = points.shape[0]
    view_shape = list(idx.shape)
    view_shape[1:] = [1] * (len(view_shape) - 1)
    repeat_shape = list(idx.shape)
    repeat_shape[0] = 1
    batch_indices = torch.arange(B, dtype=torch.long, device=device).view(view_shape).repeat(repeat_shape)
    return points[batch_indices, idx, :]

class PointNetSetAbstraction(nn.Module):
    def __init__(self, npoint, radius, nsample, in_channel, mlp):
        super().__init__()
        self.npoint = npoint
        self.radius = radius
        self.nsample = nsample
        self.mlp_convs = nn.ModuleList()
        self.mlp_bns = nn.ModuleList()
        last_channel = in_channel
        for out_channel in mlp:
            self.mlp_convs.append(nn.Conv2d(last_channel, out_channel, 1))
            self.mlp_bns.append(nn.BatchNorm2d(out_channel))
            last_channel = out_channel

    def forward(self, xyz, points):
        B, N, C = xyz.shape
        S = self.npoint
        new_xyz_idx = farthest_point_sample(xyz, self.npoint)
        new_xyz = index_points(xyz, new_xyz_idx)

        idx = query_ball_point(self.radius, self.nsample, xyz, new_xyz)
        grouped_xyz = index_points(xyz, idx)
        grouped_xyz -= new_xyz.view(B, S, 1, 3)

        if points is not None:
            grouped_points = index_points(points, idx)
            grouped_points = torch.cat([grouped_points, grouped_xyz], dim=-1)
        else:
            grouped_points = grouped_xyz

        grouped_points = grouped_points.permute(0, 3, 2, 1)  # [B, D, K, S]
        for i, conv in enumerate(self.mlp_convs):
            grouped_points = F.relu(self.mlp_bns[i](conv(grouped_points)))

        new_points = torch.max(grouped_points, 2)[0]  # [B, D, S]
        new_points = new_points.permute(0, 2, 1)
        return new_xyz, new_points

class PointNetFeaturePropagation(nn.Module):
    def __init__(self, in_channel, mlp):
        super().__init__()
        self.mlp_convs = nn.ModuleList()
        self.mlp_bns = nn.ModuleList()
        last_channel = in_channel
        for out_channel in mlp:
            self.mlp_convs.append(nn.Conv1d(last_channel, out_channel, 1))
            self.mlp_bns.append(nn.BatchNorm1d(out_channel))
            last_channel = out_channel

    def forward(self, xyz1, xyz2, points1, points2):
        B, N, C = xyz1.shape
        _, S, _ = xyz2.shape

        if S == 1:
            interpolated_points = points2.repeat(1, N, 1)
        else:
            dists = square_distance(xyz1, xyz2)
            dists, idx = dists.sort(dim=-1)
            dists, idx = dists[:, :, :3], idx[:, :, :3]
            dist_recip = 1.0 / (dists + 1e-8)
            norm = torch.sum(dist_recip, dim=2, keepdim=True)
            weight = dist_recip / norm
            interpolated_points = torch.sum(index_points(points2, idx) * weight.view(B, N, 3, 1), dim=2)

        if points1 is not None:
            new_points = torch.cat([points1, interpolated_points], dim=-1)
        else:
            new_points = interpolated_points

        new_points = new_points.permute(0, 2, 1)
        for i, conv in enumerate(self.mlp_convs):
            new_points = F.relu(self.mlp_bns[i](conv(new_points)))
        new_points = new_points.permute(0, 2, 1)
        return new_points

class PointNet2SemSeg(nn.Module):
    def __init__(self, num_classes=20):
        super().__init__()
        self.sa1 = PointNetSetAbstraction(1024, 0.1, 32, 3, [32, 32, 64])
        self.sa2 = PointNetSetAbstraction(256, 0.2, 32, 64 + 3, [64, 64, 128])
        self.sa3 = PointNetSetAbstraction(64, 0.4, 32, 128 + 3, [128, 128, 256])
        self.sa4 = PointNetSetAbstraction(16, 0.8, 32, 256 + 3, [256, 256, 512])

        self.fp4 = PointNetFeaturePropagation(512 + 256, [256, 256])
        self.fp3 = PointNetFeaturePropagation(256 + 128, [256, 256])
        self.fp2 = PointNetFeaturePropagation(256 + 64, [256, 128])
        self.fp1 = PointNetFeaturePropagation(128, [128, 128, 128])

        self.conv1 = nn.Conv1d(128, 128, 1)
        self.bn1 = nn.BatchNorm1d(128)
        self.drop1 = nn.Dropout(0.5)
        self.conv2 = nn.Conv1d(128, num_classes, 1)

    def forward(self, xyz):
        l0_points = None
        l0_xyz = xyz

        l1_xyz, l1_points = self.sa1(l0_xyz, l0_points)
        l2_xyz, l2_points = self.sa2(l1_xyz, l1_points)
        l3_xyz, l3_points = self.sa3(l2_xyz, l2_points)
        l4_xyz, l4_points = self.sa4(l3_xyz, l3_points)

        l3_points = self.fp4(l3_xyz, l4_xyz, l3_points, l4_points)
        l2_points = self.fp3(l2_xyz, l3_xyz, l2_points, l3_points)
        l1_points = self.fp2(l1_xyz, l2_xyz, l1_points, l2_points)
        l0_points = self.fp1(l0_xyz, l1_xyz, None, l1_points)

        x = l0_points.permute(0, 2, 1)
        x = F.relu(self.bn1(self.conv1(x)))
        x = self.drop1(x)
        x = self.conv2(x)
        x = F.log_softmax(x, dim=1)
        return x


# ==============================================================================
# 2. WRAPPER CLASS
# ==============================================================================

class PointNet2Wrapper(BaseSegmentationModel):
    """
    Wrapper for PointNet++ segmentation model to conform to the BaseSegmentationModel
    interface used in the Adaptive LiDAR Mapping backend.
    """
    
    def __init__(self, num_classes: int = 20, chunk_size: int = 8192, device: str = "auto", **kwargs):
        self.num_classes = num_classes
        self.chunk_size = chunk_size
        self._is_loaded = False
        
        # Determine device
        if device != "auto":
            self.device = torch.device(device)
        elif torch.backends.mps.is_available():
            self.device = torch.device("mps")
        elif torch.cuda.is_available():
            self.device = torch.device("cuda")
        else:
            self.device = torch.device("cpu")
            
        self.model = PointNet2SemSeg(num_classes=self.num_classes).to(self.device)
        self.model.eval()
        
    def load_checkpoint(self, checkpoint_path: str) -> None:
        """Load trained weights from disk."""
        checkpoint = torch.load(checkpoint_path, map_location=self.device)
        
        if "model_state_dict" in checkpoint:
            state_dict = checkpoint["model_state_dict"]
        elif "model" in checkpoint:
            state_dict = checkpoint["model"]
        else:
            state_dict = checkpoint
            
        self.model.load_state_dict(state_dict)
        self._is_loaded = True
        
    def predict_points(
        self,
        xyz: np.ndarray,
        intensity: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Run inference on a point cloud by chunking.
        
        Args:
            xyz: [N, 3] float32 — (x, y, z) coordinates.
            intensity: [N] or [N, 1] float32 — remission / intensity. Ignored.
            
        Returns:
            semantic_ids:  [N] int64  — predicted class per point.
            confidences:   [N] float32 — per-point softmax confidence.
        """
        total_points = len(xyz)
        
        predictions = np.zeros(total_points, dtype=np.int64)
        confidence = np.zeros(total_points, dtype=np.float32)
        
        self.model.eval()
        with torch.no_grad():
            for start in range(0, total_points, self.chunk_size):
                end = min(start + self.chunk_size, total_points)
                chunk_xyz = xyz[start:end].copy()
                actual_count = len(chunk_xyz)
                
                # Padding to fixed size
                if actual_count < self.chunk_size:
                    pad_count = self.chunk_size - actual_count
                    pad_indices = np.random.choice(actual_count, pad_count, replace=True)
                    padded_xyz = np.concatenate([chunk_xyz, chunk_xyz[pad_indices]], axis=0)
                else:
                    padded_xyz = chunk_xyz
                    
                # Center XY
                padded_xyz[:, :2] -= np.mean(padded_xyz[:, :2], axis=0, keepdims=True)
                
                input_tensor = torch.from_numpy(padded_xyz).float().unsqueeze(0).to(self.device)
                
                log_probs = self.model(input_tensor)
                probs = torch.exp(log_probs)
                
                pred = probs.argmax(dim=1)[0]
                conf = probs.max(dim=1).values[0]
                
                predictions[start:end] = pred[:actual_count].cpu().numpy()
                confidence[start:end] = conf[:actual_count].cpu().numpy()
                
        return predictions, confidence
        
    def get_model_name(self) -> str:
        """Unique short name"""
        return "pointnet2"
        
    def get_num_classes(self) -> int:
        """Number of output classes (including unlabeled)."""
        return self.num_classes
        
    def get_device(self) -> str:
        """Return the device string the model is running on."""
        return str(self.device)
        
    def is_loaded(self) -> bool:
        """Return True if a checkpoint has been loaded successfully."""
        return self._is_loaded
        
    def warmup(self, num_points: int = 4096) -> None:
        """Run a dummy forward pass to warm up JIT / GPU caches."""
        if not self._is_loaded:
            return
        dummy_xyz = np.random.randn(num_points, 3).astype(np.float32)
        self.predict_points(dummy_xyz)
