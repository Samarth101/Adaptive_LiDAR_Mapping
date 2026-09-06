"""
Precomputed Model Wrapper
===========================
Loads pre-saved per-frame predictions from disk instead of running
live model inference.  This enables using Cylinder3D / MinkUNet results
on machines without CUDA (e.g. MacBook for the demo) by pre-computing
predictions on Colab/Kaggle and transferring the .npz files.

Usage::

    # On Colab (GPU): run Cylinder3D inference and save predictions
    python scripts/export_predictions.py --model cylinder3d --seq 00 08

    # On Mac: load those predictions
    from backend.models.precomputed_wrapper import PrecomputedModelWrapper
    model = PrecomputedModelWrapper(
        predictions_dir="predictions/cylinder3d",
        model_name="cylinder3d",
    )
    model.load_checkpoint("")  # no-op, already loaded
    sem_ids, confs = model.predict_points(xyz)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np

from backend.models.base import BaseSegmentationModel

logger = logging.getLogger(__name__)


class PrecomputedModelWrapper(BaseSegmentationModel):
    """Serves pre-saved predictions from disk.

    Predictions are stored as ``.npz`` files, one per frame::

        predictions/cylinder3d/
        ├── 00/
        │   ├── 000000.npz   # keys: semantic_ids, confidences
        │   ├── 000001.npz
        │   ...
        ├── 08/
        │   ...

    The wrapper is indexed by ``(sequence, frame_id)`` which the
    FrameProcessor supplies.  If a prediction file is missing for a
    frame, a uniform "unlabeled" prediction with zero confidence is
    returned.
    """

    def __init__(
        self,
        predictions_dir: str = "",
        model_name: str = "cylinder3d_precomputed",
        num_classes: int = 20,
        device: str = "cpu",
        **kwargs,
    ):
        self._name = model_name
        self._num_classes = num_classes
        self._predictions_dir = Path(predictions_dir) if predictions_dir else None
        self._device = device
        self._loaded = False
        self._cache: Dict[Tuple[str, int], Tuple[np.ndarray, np.ndarray]] = {}

        # Current frame context (set by caller before predict)
        self._current_sequence: str = "00"
        self._current_frame_id: int = 0

        if predictions_dir:
            self._scan_predictions()

    def _scan_predictions(self) -> None:
        """Scan the predictions directory and build an index."""
        if self._predictions_dir is None or not self._predictions_dir.exists():
            logger.warning(
                f"Predictions directory not found: {self._predictions_dir}"
            )
            return

        count = 0
        for seq_dir in sorted(self._predictions_dir.iterdir()):
            if not seq_dir.is_dir():
                continue
            for npz_file in sorted(seq_dir.glob("*.npz")):
                seq = seq_dir.name
                frame_id = int(npz_file.stem)
                # Store path, load lazily
                self._cache[(seq, frame_id)] = npz_file  # type: ignore
                count += 1

        self._loaded = count > 0
        logger.info(
            f"PrecomputedModelWrapper '{self._name}': "
            f"indexed {count} prediction files from {self._predictions_dir}"
        )

    def set_frame_context(self, sequence: str, frame_id: int) -> None:
        """Set the current frame context for the next predict call.

        The FrameProcessor calls this before predict_points().
        """
        self._current_sequence = sequence
        self._current_frame_id = frame_id

    def load_checkpoint(self, checkpoint_path: str) -> None:
        """No-op — predictions are already on disk."""
        if self._predictions_dir is not None:
            self._scan_predictions()

    def predict_points(
        self,
        xyz: np.ndarray,
        intensity: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Load pre-computed predictions for the current frame.

        Falls back to zeros if no prediction file exists.
        """
        N = len(xyz)
        key = (self._current_sequence, self._current_frame_id)

        if key in self._cache:
            entry = self._cache[key]

            # Lazy loading: if entry is a Path, load and replace
            if isinstance(entry, Path):
                data = np.load(str(entry))
                sem_ids = data["semantic_ids"].astype(np.int64)
                confs = data["confidences"].astype(np.float32)
                self._cache[key] = (sem_ids, confs)
            else:
                sem_ids, confs = entry

            # Handle size mismatch (different point sampling)
            if len(sem_ids) != N:
                logger.warning(
                    f"Point count mismatch for {key}: "
                    f"predicted {len(sem_ids)}, got {N}. Truncating/padding."
                )
                if len(sem_ids) > N:
                    sem_ids = sem_ids[:N]
                    confs = confs[:N]
                else:
                    sem_ids = np.pad(sem_ids, (0, N - len(sem_ids)), constant_values=0)
                    confs = np.pad(confs, (0, N - len(confs)), constant_values=0.0)

            return sem_ids, confs

        # No prediction file — return unlabeled
        logger.debug(
            f"No precomputed prediction for seq={self._current_sequence}, "
            f"frame={self._current_frame_id}"
        )
        return (
            np.zeros(N, dtype=np.int64),
            np.zeros(N, dtype=np.float32),
        )

    def get_model_name(self) -> str:
        return self._name

    def get_num_classes(self) -> int:
        return self._num_classes

    def get_device(self) -> str:
        return self._device

    def is_loaded(self) -> bool:
        return self._loaded

    def warmup(self, num_points: int = 4096) -> None:
        """No-op for precomputed predictions."""
        pass
