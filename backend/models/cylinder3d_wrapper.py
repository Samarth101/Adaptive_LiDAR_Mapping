"""
Cylinder3D Wrapper
==================
Wraps the Cylinder3D architecture (spconv v2 compatible) into
the BaseSegmentationModel interface for the Adaptive LiDAR backend.

Uses the architecture from: L-Reichardt/Cylinder3D-updated-CUDA
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Optional, Tuple

import numpy as np

from backend.models.base import BaseSegmentationModel

logger = logging.getLogger(__name__)

# ==============================================================================
# Graceful Imports
# ==============================================================================
SPCONV_AVAILABLE = False
TORCH_AVAILABLE = False
_IMPORT_ERROR: Optional[str] = None

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    pass

try:
    import spconv.pytorch as spconv
    SPCONV_AVAILABLE = True
except ImportError as exc:
    _IMPORT_ERROR = str(exc)

# Add third_party path so we can import the Cylinder3D network
_THIRD_PARTY = Path(__file__).resolve().parent.parent / "third_party" / "Cylinder3D"
if str(_THIRD_PARTY) not in sys.path:
    sys.path.insert(0, str(_THIRD_PARTY))

CYLINDER3D_AVAILABLE = False
try:
    if SPCONV_AVAILABLE and TORCH_AVAILABLE:
        from network.segmentator_3d_asymm_spconv import Asymm_3d_spconv
        from network.cylinder_fea_generator import cylinder_fea
        from network.cylinder_spconv_3d import cylinder_asym
        CYLINDER3D_AVAILABLE = True
except ImportError as exc:
    _IMPORT_ERROR = str(exc)


class Cylinder3DWrapper(BaseSegmentationModel):
    """
    Wrapper for Cylinder3D to conform to the BaseSegmentationModel interface.

    Cylinder3D performs 3D semantic segmentation using cylindrical coordinate
    representations and asymmetrical 3D sparse convolutional networks.
    """

    # Default config matching SemanticKITTI settings
    DEFAULT_GRID_SIZE = [480, 360, 32]
    DEFAULT_FEA_DIM = 9
    DEFAULT_OUT_PT_FEA_DIM = 256
    DEFAULT_FEA_COMPRE = 16

    def __init__(self, config=None, device: str = 'auto', num_classes: int = 20, **kwargs):
        self._num_classes = num_classes
        self._is_loaded = False
        self._model = None

        # Resolve device
        if device == "auto":
            if TORCH_AVAILABLE and torch.cuda.is_available():
                self._device_str = "cuda"
            else:
                self._device_str = "cpu"
        else:
            self._device_str = device

        self.grid_size = self.DEFAULT_GRID_SIZE
        self.fea_dim = self.DEFAULT_FEA_DIM
        self.out_pt_fea_dim = self.DEFAULT_OUT_PT_FEA_DIM
        self.fea_compre = self.DEFAULT_FEA_COMPRE

        if not CYLINDER3D_AVAILABLE:
            logger.warning(
                f"Cylinder3D dependencies not available. "
                f"Import error: {_IMPORT_ERROR}"
            )
            return

        self._build_model()

    def _build_model(self) -> None:
        """Build the full Cylinder3D model from components."""
        # 1. Cylinder feature generator (point → voxel features)
        cylinder_model = cylinder_fea(
            grid_size=self.grid_size,
            fea_dim=self.fea_dim,
            out_pt_fea_dim=self.out_pt_fea_dim,
            fea_compre=self.fea_compre,
        )

        # 2. Asymmetric 3D sparse conv UNet (voxel segmentation)
        spconv_model = Asymm_3d_spconv(
            output_shape=self.grid_size,
            num_input_features=self.fea_compre,
            nclasses=self._num_classes,
            n_height=self.grid_size[2],
            init_size=16,
        )

        # 3. Combined model
        self._model = cylinder_asym(
            cylin_model=cylinder_model,
            segmentator_spconv=spconv_model,
            sparse_shape=self.grid_size,
        )
        self._model.to(self._device_str)
        self._model.eval()
        logger.info(f"Cylinder3D model built on {self._device_str}")

    def _check_available(self) -> None:
        if not CYLINDER3D_AVAILABLE:
            raise RuntimeError(
                "Cylinder3D is not available. Install with:\n"
                "  pip install spconv-cu120  # or spconv-cu124\n"
                f"Original error: {_IMPORT_ERROR}"
            )

    def load_checkpoint(self, checkpoint_path: str) -> None:
        """Load trained weights from disk."""
        self._check_available()

        if not os.path.exists(checkpoint_path):
            raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

        checkpoint = torch.load(checkpoint_path, map_location=self._device_str)

        # Handle different checkpoint formats
        if "model_state_dict" in checkpoint:
            state_dict = checkpoint["model_state_dict"]
        elif "state_dict" in checkpoint:
            state_dict = checkpoint["state_dict"]
        elif "model" in checkpoint:
            state_dict = checkpoint["model"]
        else:
            state_dict = checkpoint

        self._model.load_state_dict(state_dict, strict=False)
        self._model.eval()
        self._is_loaded = True
        logger.info(f"Loaded Cylinder3D checkpoint from {checkpoint_path}")

    def _prepare_input(self, xyz: torch.Tensor, intensity: Optional[torch.Tensor] = None):
        """
        Prepare input for Cylinder3D using pure PyTorch on GPU:
        1. Convert XYZ+intensity to cylindrical coordinates
        2. Compute 9-dim per-point features
        3. Voxelize into cylindrical grid
        """
        N = xyz.shape[0]
        if intensity is None:
            intensity = torch.zeros(N, dtype=torch.float32, device=xyz.device)
        else:
            intensity = intensity.flatten()

        x, y, z = xyz[:, 0], xyz[:, 1], xyz[:, 2]

        # Cylindrical coordinates
        rho = torch.sqrt(x ** 2 + y ** 2)
        theta = torch.atan2(y, x)  # [-pi, pi]

        # Normalize
        rho_min, rho_max_val = rho.min(), rho.max()
        rho_norm = (rho - rho_min) / (rho_max_val - rho_min + 1e-6)
        
        z_min, z_max_val = z.min(), z.max()
        z_norm = (z - z_min) / (z_max_val - z_min + 1e-6)

        # 9-dim features: [x, y, z, intensity, rho, theta, z, rho_norm, z_norm]
        point_features = torch.stack([
            x, y, z, intensity, rho, theta, z, rho_norm, z_norm
        ], dim=-1).to(torch.float32)

        # Voxelize: map each point to a grid cell
        grid_rho = self.grid_size[0]
        grid_theta = self.grid_size[1]
        grid_z = self.grid_size[2]

        # Compute voxel indices
        rho_max_clamp = torch.clamp_min(rho_max_val, 50.0)
        z_min_clamp = torch.clamp_max(z_min, -3.0)
        z_max_clamp = torch.clamp_min(z_max_val, 1.0)

        rho_idx = torch.clamp((rho / rho_max_clamp * grid_rho).to(torch.int64), 0, grid_rho - 1)
        theta_idx = torch.clamp(((theta + torch.pi) / (2 * torch.pi) * grid_theta).to(torch.int64), 0, grid_theta - 1)
        z_idx = torch.clamp(((z - z_min_clamp) / (z_max_clamp - z_min_clamp + 1e-6) * grid_z).to(torch.int64), 0, grid_z - 1)

        voxel_indices = torch.stack([rho_idx, theta_idx, z_idx], dim=-1).to(torch.int64)

        return point_features, voxel_indices

    def predict_points(
        self,
        xyz: np.ndarray,
        intensity: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Run inference on a point cloud using the Cylinder3D pipeline."""
        self._check_available()

        if not self._is_loaded and self._model is None:
            raise RuntimeError("Model not loaded. Call load_checkpoint() first.")

        device = self._device_str
        
        # Enable cuDNN auto-tuner for consistent input sizes
        if device == "cuda":
            torch.backends.cudnn.benchmark = True
        
        # Convert to tensors directly on device
        xyz_tensor = torch.from_numpy(xyz).float().to(device)
        intensity_tensor = torch.from_numpy(intensity).float().to(device) if intensity is not None else None

        # Prepare input on GPU
        pt_fea_tensor, vox_ind_tensor = self._prepare_input(xyz_tensor, intensity_tensor)

        with torch.no_grad():
            # Use mixed precision (FP16) for faster inference on CUDA
            use_amp = (device == "cuda")
            with torch.amp.autocast('cuda', enabled=use_amp):
                # Forward pass through the combined model
                output = self._model(
                    [pt_fea_tensor],      # list of per-batch point features
                    [vox_ind_tensor],     # list of per-batch voxel indices
                    batch_size=1,
                )

            # output shape: [batch, nclasses, grid_rho, grid_theta, grid_z]
            # Map voxel predictions back to points
            probs = torch.softmax(output[0].float(), dim=0)  # [nclasses, R, T, Z]
            pred_grid = probs.argmax(dim=0)           # [R, T, Z]
            conf_grid = probs.max(dim=0).values       # [R, T, Z]

            # Look up each point's prediction from its voxel
            r_idx = vox_ind_tensor[:, 0]
            t_idx = vox_ind_tensor[:, 1]
            z_idx = vox_ind_tensor[:, 2]

            semantic_ids = pred_grid[r_idx, t_idx, z_idx].cpu().numpy().astype(np.int64)
            confidences = conf_grid[r_idx, t_idx, z_idx].cpu().numpy().astype(np.float32)

        # Safety: If any predictions are > 19, the checkpoint outputs raw
        # SemanticKITTI IDs (10, 40, 70...) instead of training IDs (0-19).
        # Apply learning map remapping to fix this.
        if np.any(semantic_ids > 19):
            from backend.utils.class_mapping import remap_labels
            logger.info("Cylinder3D output contains raw SemanticKITTI IDs — remapping to training IDs.")
            semantic_ids = remap_labels(semantic_ids)

        return semantic_ids, confidences

    def get_model_name(self) -> str:
        return "cylinder3d"

    def get_num_classes(self) -> int:
        return self._num_classes

    def get_device(self) -> str:
        return self._device_str

    def is_loaded(self) -> bool:
        return self._is_loaded

    def warmup(self, num_points: int = 4096) -> None:
        """Run a dummy forward pass to warm up GPU caches."""
        if not CYLINDER3D_AVAILABLE or self._model is None:
            return
        dummy_xyz = np.random.randn(num_points, 3).astype(np.float32) * 20
        try:
            self.predict_points(dummy_xyz)
        except Exception as e:
            logger.warning(f"Cylinder3D warmup failed: {e}")
