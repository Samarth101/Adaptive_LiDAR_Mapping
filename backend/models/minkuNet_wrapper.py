"""
MinkUNet Wrapper (via MMDetection3D)
=====================================
Wraps a MinkowskiEngine-based UNet from the MMDetection3D framework into
the ``BaseSegmentationModel`` interface.

This is an **optional** model.  If the OpenMMLab stack
(mmengine + mmcv + mmdet + mmdet3d + MinkowskiEngine) is not installed,
the wrapper is still importable but raises clear errors when instantiated.
"""

from __future__ import annotations

import logging
from typing import Optional, Tuple

import numpy as np

from backend.models.base import BaseSegmentationModel

logger = logging.getLogger(__name__)

# ── Attempt optional imports ────────────────────────────────────────────

_MMDET3D_AVAILABLE = False
_IMPORT_ERROR: Optional[str] = None

try:
    import torch
    from mmengine.config import Config
    from mmengine.runner import load_checkpoint as mm_load_checkpoint
    from mmdet3d.apis import init_model
    from mmdet3d.structures import Det3DDataSample, PointData
    _MMDET3D_AVAILABLE = True
except ImportError as exc:
    _IMPORT_ERROR = str(exc)
    # Define a minimal torch stub so the class body can parse
    try:
        import torch
    except ImportError:
        torch = None  # type: ignore[assignment]


class MinkUNetWrapper(BaseSegmentationModel):
    """MinkUNet semantic segmentation via MMDetection3D.

    If the OpenMMLab stack is not installed, calling any method that
    requires the model will raise ``RuntimeError`` with install instructions.
    """

    def __init__(
        self,
        config_path: str = "",
        checkpoint_path: str = "",
        device: str = "auto",
        num_classes: int = 20,
    ):
        self._name = "minkuNet"
        self._num_classes = num_classes
        self._loaded = False
        self._model = None
        self._device_str = device

        if not _MMDET3D_AVAILABLE:
            logger.warning(
                "MMDetection3D is NOT installed. MinkUNet wrapper is "
                "available as a stub only.  To enable, install:\n"
                "  pip install mmengine mmcv mmdet mmdet3d\n"
                "  pip install MinkowskiEngine\n"
                f"Import error: {_IMPORT_ERROR}"
            )
            return

        # Resolve device
        if device == "auto":
            self._device_str = "cuda" if torch.cuda.is_available() else "cpu"

        if config_path and checkpoint_path:
            self._init_model(config_path, checkpoint_path)

    def _check_available(self) -> None:
        if not _MMDET3D_AVAILABLE:
            raise RuntimeError(
                "MMDetection3D is not installed.  Install with:\n"
                "  pip install mmengine mmcv>=2.0 mmdet>=3.0 mmdet3d>=1.4\n"
                "  pip install MinkowskiEngine\n"
                f"Original error: {_IMPORT_ERROR}"
            )

    def _init_model(self, config_path: str, checkpoint_path: str) -> None:
        """Initialise the MMDet3D model from config + checkpoint."""
        self._check_available()
        logger.info(
            f"Loading MinkUNet from:\n"
            f"  config:     {config_path}\n"
            f"  checkpoint: {checkpoint_path}"
        )
        self._model = init_model(
            config_path,
            checkpoint_path,
            device=self._device_str,
        )
        self._model.eval()
        self._loaded = True
        logger.info("MinkUNet loaded successfully.")

    # ── BaseSegmentationModel interface ──────────────────────────────────

    def load_checkpoint(self, checkpoint_path: str) -> None:
        """Load weights.  Requires config_path to have been set at init."""
        self._check_available()
        if self._model is None:
            raise RuntimeError(
                "MinkUNet model not initialised. "
                "Pass config_path at construction time."
            )
        mm_load_checkpoint(self._model, checkpoint_path)
        self._loaded = True

    def predict_points(
        self,
        xyz: np.ndarray,
        intensity: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Run MinkUNet inference on a full point cloud.

        The MMDetection3D pipeline handles voxelization internally
        according to the model config.
        """
        self._check_available()
        if not self._loaded or self._model is None:
            raise RuntimeError("Model not loaded. Call load_checkpoint() first.")

        N = len(xyz)

        # Build the input dict that MMDet3D expects
        points_tensor = torch.from_numpy(
            np.hstack([
                xyz,
                (intensity.reshape(-1, 1)
                 if intensity is not None
                 else np.zeros((N, 1), dtype=np.float32)),
            ]).astype(np.float32)
        ).to(self._device_str)

        data = {
            "points": [points_tensor],
            "data_samples": [Det3DDataSample()],
        }

        # Run inference through the MMDet3D pipeline
        with torch.no_grad():
            results = self._model.test_step(data)

        # Extract per-point predictions
        result = results[0]
        pts_seg = result.pred_pts_seg

        # pts_seg.pts_semantic_mask is the predicted class per point
        pred_ids = pts_seg.pts_semantic_mask.cpu().numpy().astype(np.int64)

        # Try to get logits for confidence; fall back to binary confidence
        if hasattr(pts_seg, "pts_seg_logits"):
            logits = pts_seg.pts_seg_logits.cpu().numpy()
            probs = _softmax(logits)
            confidences = probs.max(axis=1).astype(np.float32)
        else:
            confidences = np.ones(N, dtype=np.float32)

        return pred_ids[:N], confidences[:N]

    def get_model_name(self) -> str:
        return self._name

    def get_num_classes(self) -> int:
        return self._num_classes

    def get_device(self) -> str:
        return self._device_str

    def is_loaded(self) -> bool:
        return self._loaded


def _softmax(logits: np.ndarray) -> np.ndarray:
    """Row-wise softmax."""
    e = np.exp(logits - logits.max(axis=1, keepdims=True))
    return e / e.sum(axis=1, keepdims=True)
