import os
import sys
import time
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader

# ==============================================================================
# 1. ARCHITECTURE: POINTNET++ MODULES
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
# 2. DATASET AND PARALLEL LOADER SETUP
# ==============================================================================

LEARNING_MAP = {
    0: 0, 1: 0, 10: 1, 11: 2, 13: 5, 15: 3, 16: 5, 18: 4, 20: 5, 30: 6, 31: 7, 
    32: 8, 40: 9, 44: 10, 48: 11, 49: 12, 50: 13, 51: 14, 52: 0, 60: 9, 70: 15, 
    71: 16, 72: 17, 80: 18, 81: 19, 99: 0, 252: 1, 253: 7, 254: 6, 255: 8, 
    256: 5, 257: 5, 258: 4, 259: 5
}

class SemanticKittiDataset(Dataset):
    def __init__(self, root_dir, seqs, num_points=8192):
        self.root_dir = root_dir
        self.num_points = num_points
        self.scans = []
        self.labels = []
        
        self.learning_map = np.zeros(260, dtype=np.int64)
        for k, v in LEARNING_MAP.items():
            self.learning_map[k] = v
        
        for seq in seqs:
            scan_path = os.path.join(root_dir, 'data_odometry_velodyne', 'dataset', 'sequences', seq, 'velodyne')
            label_path = os.path.join(root_dir, 'data_odometry_labels', 'dataset', 'sequences', seq, 'labels')
            
            if not os.path.exists(scan_path) or not os.path.exists(label_path):
                continue
                
            seq_scans = sorted([os.path.join(scan_path, f) for f in os.listdir(scan_path) if f.endswith('.bin')])
            seq_labels = sorted([os.path.join(label_path, f) for f in os.listdir(label_path) if f.endswith('.label')])
            
            self.scans.extend(seq_scans)
            self.labels.extend(seq_labels)
            
        print(f"Loaded {len(self.scans)} frames from sequences: {seqs}")

    def __len__(self): 
        return len(self.scans)

    def __getitem__(self, idx):
        scan = np.fromfile(self.scans[idx], dtype=np.float32).reshape(-1, 4)
        points = scan[:, :3]
        
        label_data = np.fromfile(self.labels[idx], dtype=np.uint32)
        sem_label = label_data & 0xFFFF 
        sem_label = self.learning_map[sem_label]
        
        if len(points) > self.num_points:
            choice = np.random.choice(len(points), self.num_points, replace=False)
            points = points[choice, :]
            sem_label = sem_label[choice]
            
        return torch.FloatTensor(points), torch.LongTensor(sem_label)

# Root directory discovery
DATA_PATH = None
for root, dirs, files in os.walk('/kaggle/input'):
    if 'data_odometry_velodyne' in dirs and 'data_odometry_labels' in dirs:
        DATA_PATH = root
        break

if DATA_PATH is None:
    raise ValueError("Dataset root directory not found in /kaggle/input.")

print(f"Dataset root: {DATA_PATH}")

TRAIN_SEQS = ["00", "01", "02", "03", "04", "05", "06", "07", "09", "10"]
train_dataset = SemanticKittiDataset(DATA_PATH, TRAIN_SEQS, num_points=8192)

# batch_size=16 (8 per GPU on Dual T4)
# pin_memory=True & prefetch_factor=2 eliminate data starvation bottlenecks
train_loader = DataLoader(
    train_dataset, 
    batch_size=16, 
    shuffle=True, 
    num_workers=4, 
    pin_memory=True, 
    prefetch_factor=2, 
    drop_last=True
)

# ==============================================================================
# 3. DUAL-GPU HARDWARE SETUP & TRAINING PIPELINE
# ==============================================================================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
num_gpus = torch.cuda.device_count()
print(f"Available GPUs: {num_gpus}")

model = PointNet2SemSeg(num_classes=20)

# Wrap model with DataParallel across both GPUs
if num_gpus > 1:
    print(f"Distributing workload across {num_gpus} GPUs using DataParallel.")
    model = nn.DataParallel(model)

model = model.to(device)

criterion = nn.NLLLoss(ignore_index=0)
optimizer = optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-4)
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=10, gamma=0.5)

EPOCHS = 50
PRINT_FREQ = 10  # Real-time terminal output every 10 batches
save_dir = '/kaggle/working/'

print(f"\n--- Starting SemanticKITTI Training ({EPOCHS} Epochs, {len(train_loader)} Batches/Epoch) ---")

for epoch in range(EPOCHS):
    model.train()
    epoch_start_time = time.time()
    
    running_loss = 0.0
    correct_points = 0
    total_valid_points = 0
    
    print(f"\n==================== Epoch {epoch+1}/{EPOCHS} ====================")
    
    for i, (points, labels) in enumerate(train_loader):
        # Non-blocking async transfer paired with pin_memory
        points = points.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)
        
        optimizer.zero_grad()
        
        preds = model(points)  # Output: [B, 20, N]
        loss = criterion(preds, labels)
        
        loss.backward()
        optimizer.step()
        
        running_loss += loss.item()
        
        with torch.no_grad():
            pred_classes = preds.argmax(dim=1)
            valid_mask = labels != 0
            correct_points += (pred_classes[valid_mask] == labels[valid_mask]).sum().item()
            total_valid_points += valid_mask.sum().item()
            
        # Real-time console progress
        if (i + 1) % PRINT_FREQ == 0:
            avg_loss = running_loss / PRINT_FREQ
            current_acc = (correct_points / total_valid_points) * 100 if total_valid_points > 0 else 0.0
            
            elapsed_sec = time.time() - epoch_start_time
            batches_done = i + 1
            batches_left = len(train_loader) - batches_done
            sec_per_batch = elapsed_sec / batches_done
            eta_sec = batches_left * sec_per_batch
            
            elapsed_str = time.strftime('%H:%M:%S', time.gmtime(elapsed_sec))
            eta_str = time.strftime('%H:%M:%S', time.gmtime(eta_sec))
            
            # Flush output to prevent buffering delays in Kaggle console
            print(
                f"Batch [{batches_done:04d}/{len(train_loader)}] | "
                f"Elapsed: {elapsed_str} | ETA: {eta_str} | "
                f"Loss: {avg_loss:.4f} | Acc: {current_acc:.2f}%"
            )
            sys.stdout.flush()
            
            running_loss = 0.0
            correct_points = 0
            total_valid_points = 0

    scheduler.step()
    
    epoch_duration = (time.time() - epoch_start_time) / 60
    current_lr = optimizer.param_groups[0]['lr']
    print(f"Epoch {epoch+1} Completed in {epoch_duration:.2f} mins | LR: {current_lr:.6f}")
    
    # Save checkpoint (extracting module state dict handles nn.DataParallel unwrapping)
    raw_model = model.module if isinstance(model, nn.DataParallel) else model
    checkpoint_path = os.path.join(save_dir, f'pointnet2_semantickitti_ep{epoch+1}.pth')
    
    torch.save({
        'epoch': epoch + 1,
        'model_state_dict': raw_model.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
        'scheduler_state_dict': scheduler.state_dict(),
    }, checkpoint_path)
    print(f"Checkpoint saved: {checkpoint_path}")