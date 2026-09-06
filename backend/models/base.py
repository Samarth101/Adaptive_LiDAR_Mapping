"""
Abstract Base Model Interface
==============================
Every segmentation model (PointNet++, Cylinder3D, MinkUNet) MUST implement
this interface so the backend can hot-swap models without changing any
downstream code.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np


@dataclass
class ModelPrediction:
    """Container for a single-frame prediction from any model."""

    # Per-point outputs — shape [N]
    semantic_ids: np.ndarray      # int64  — predicted training class ID per point
    confidences: np.ndarray       # float32 — softmax confidence per point

    # Timing
    inference_ms: float           # wall-clock milliseconds for model forward pass

    # Metadata
    model_name: str
    num_points: int
    device: str


class BaseSegmentationModel(ABC):
    """Abstract interface for LiDAR semantic segmentation models.

    All three models implement this so the FrameProcessor and server
    can treat them identically.
    """

    # ── Required overrides ───────────────────────────────────────────────

    @abstractmethod
    def load_checkpoint(self, checkpoint_path: str) -> None:
        """Load trained weights from disk."""
        ...

    @abstractmethod
    def predict_points(
        self,
        xyz: np.ndarray,
        intensity: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Run inference on a point cloud.

        Args:
            xyz: [N, 3] float32 — (x, y, z) coordinates.
            intensity: [N] or [N, 1] float32 — remission / intensity.
                       May be ``None`` if the model does not use it.

        Returns:
            semantic_ids:  [N] int64  — predicted class per point.
            confidences:   [N] float32 — per-point softmax confidence.
        """
        ...

    @abstractmethod
    def get_model_name(self) -> str:
        """Unique short name, e.g. 'pointnet2', 'cylinder3d'."""
        ...

    @abstractmethod
    def get_num_classes(self) -> int:
        """Number of output classes (including unlabeled)."""
        ...

    # ── Optional overrides ───────────────────────────────────────────────

    def warmup(self, num_points: int = 4096) -> None:
        """Run a dummy forward pass to warm up JIT / GPU caches."""
        dummy_xyz = np.random.randn(num_points, 3).astype(np.float32)
        self.predict_points(dummy_xyz)

    def get_device(self) -> str:
        """Return the device string the model is running on."""
        return "unknown"

    def is_loaded(self) -> bool:
        """Return True if a checkpoint has been loaded successfully."""
        return False

    # ── Convenience wrapper ──────────────────────────────────────────────

    def predict(
        self,
        points: np.ndarray,
        intensity: Optional[np.ndarray] = None,
    ) -> ModelPrediction:
        """Predict with timing.  Delegates to ``predict_points``.

        Args:
            points:    [N, 3] or [N, 4] float32.
                       If 4 columns, column 3 is treated as intensity.
            intensity: explicit intensity override; takes priority if given.
        """
        # Separate xyz and optional intensity
        if points.shape[1] >= 4 and intensity is None:
            xyz = points[:, :3].astype(np.float32)
            intensity = points[:, 3].astype(np.float32)
        else:
            xyz = points[:, :3].astype(np.float32)

        t0 = time.perf_counter()
        sem_ids, confs = self.predict_points(xyz, intensity)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        return ModelPrediction(
            semantic_ids=sem_ids,
            confidences=confs,
            inference_ms=elapsed_ms,
            model_name=self.get_model_name(),
            num_points=len(xyz),
            device=self.get_device(),
        )
