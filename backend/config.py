"""
Backend Configuration
=====================
Centralized configuration for the SIH26053 adaptive LiDAR mapping backend.
All paths, resolution bands, model settings, and server parameters live here.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Tuple


def _backend_root() -> Path:
    """Return the backend directory."""
    return Path(__file__).resolve().parent


def _find_dir(dir_name: str) -> Path:
    """Locate a directory: checks inside backend/ first, then repo root fallback."""
    backend_path = _backend_root() / dir_name
    if backend_path.exists():
        return backend_path
    parent_path = _backend_root().parent / dir_name
    if parent_path.exists():
        return parent_path
    return backend_path


@dataclass
class ResolutionBand:
    """One ring of the foveated resolution grid."""
    min_distance: float   # metres (inclusive)
    max_distance: float   # metres (exclusive)
    cell_size: float      # metres per cell edge


# ── Default resolution zones (matching the handoff document) ──────────────
DEFAULT_RESOLUTION_BANDS: List[ResolutionBand] = [
    ResolutionBand(0.0,   10.0,  0.05),   # 0–10 m  → 5 cm
    ResolutionBand(10.0,  30.0,  0.10),   # 10–30 m → 10 cm
    ResolutionBand(30.0,  60.0,  0.25),   # 30–60 m → 25 cm
    ResolutionBand(60.0, 100.0,  0.50),   # 60–100 m → 50 cm
]

# ── Distance bands for per-range accuracy evaluation ─────────────────────
DEFAULT_DISTANCE_BANDS: List[Tuple[float, float]] = [
    (0.0, 10.0),
    (10.0, 30.0),
    (30.0, 60.0),
    (60.0, 100.0),
]


@dataclass
class BackendConfig:
    """Master configuration for the ML backend."""

    # ── Dataset paths ────────────────────────────────────────────────────
    velodyne_root: str = str(
        _find_dir("data") / "dataset" / "sequences"
    )
    label_root: str = str(
        _find_dir("data") / "data_odometry_labels"
        / "dataset" / "sequences"
    )
    yaml_config: str = str(
        _find_dir("config") / "semantic-kitti.yaml"
    )

    # ── Resolution configuration ─────────────────────────────────────────
    resolution_bands: List[ResolutionBand] = field(
        default_factory=lambda: list(DEFAULT_RESOLUTION_BANDS)
    )
    distance_bands: List[Tuple[float, float]] = field(
        default_factory=lambda: list(DEFAULT_DISTANCE_BANDS)
    )

    # ── Model settings ───────────────────────────────────────────────────
    default_model: str = "cylinder3d"
    checkpoint_dir: str = str(_find_dir("checkpoints"))
    predictions_dir: str = str(_find_dir("predictions"))
    device: str = "auto"       # "auto" | "cuda" | "mps" | "cpu"
    num_classes: int = 20      # SemanticKITTI 20-class contract (0=unlabeled)

    # ── PointNet++ specific ──────────────────────────────────────────────
    pointnet2_num_points: int = 8192
    pointnet2_checkpoint: str = ""  # set when weights are ready

    # ── Cylinder3D specific ──────────────────────────────────────────────
    cylinder3d_grid_size: List[int] = field(
        default_factory=lambda: [480, 360, 32]
    )
    cylinder3d_checkpoint: str = str(_find_dir("checkpoints") / "cylinder3d" / "epoch_28_miou_63.pt")

    # ── MinkUNet / MMDet3D specific ──────────────────────────────────────
    minkuNet_config: str = ""
    minkuNet_checkpoint: str = ""

    # ── Server settings ──────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000
    target_fps: float = 10.0
    cors_origins: List[str] = field(
        default_factory=lambda: ["http://localhost:3000",
                                  "http://localhost:5173",
                                  "http://127.0.0.1:3000",
                                  "http://127.0.0.1:5173"]
    )

    # ── SemanticKITTI sequence splits ────────────────────────────────────
    train_sequences: List[str] = field(
        default_factory=lambda: [
            "00", "01", "02", "03", "04",
            "05", "06", "07", "09", "10",
        ]
    )
    val_sequences: List[str] = field(
        default_factory=lambda: ["08"]
    )
    test_sequences: List[str] = field(
        default_factory=lambda: [
            "11", "12", "13", "14", "15",
            "16", "17", "18", "19", "20", "21",
        ]
    )

    # ── Derived helpers ──────────────────────────────────────────────────

    def resolve_device(self) -> str:
        """Return the concrete device string."""
        if self.device != "auto":
            return self.device

        import torch

        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
        return "cpu"

    def scan_path(self, sequence: str, frame: int) -> Path:
        """Absolute path to a velodyne .bin file."""
        return (
            Path(self.velodyne_root)
            / sequence
            / "velodyne"
            / f"{frame:06d}.bin"
        )

    def label_path(self, sequence: str, frame: int) -> Path:
        """Absolute path to a .label file."""
        return (
            Path(self.label_root)
            / sequence
            / "labels"
            / f"{frame:06d}.label"
        )

    def list_frames(self, sequence: str) -> List[int]:
        """Return sorted frame indices for a sequence."""
        vel_dir = Path(self.velodyne_root) / sequence / "velodyne"
        if not vel_dir.exists():
            return []
        return sorted(
            int(p.stem) for p in vel_dir.glob("*.bin")
        )
