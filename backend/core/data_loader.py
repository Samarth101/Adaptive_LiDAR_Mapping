"""
SemanticKITTI Data Loader
==========================
Unified loader for velodyne scans and label files.
Refactored from ``src/semantic_kitti_loader.py`` with additional sequence
enumeration and calibration support.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

from backend.utils.class_mapping import remap_labels


# ─────────────────────────────────────────────────────────────────────────
# Single-frame loading
# ─────────────────────────────────────────────────────────────────────────

def load_scan(bin_path: str | Path) -> np.ndarray:
    """Load one SemanticKITTI LiDAR scan.

    Returns
    -------
    points : ndarray, shape (N, 4), dtype float32
        Columns are (x, y, z, remission).
    """
    bin_path = Path(bin_path)
    if not bin_path.exists():
        raise FileNotFoundError(f"Scan not found: {bin_path}")

    data = np.fromfile(str(bin_path), dtype=np.float32)
    if data.size % 4 != 0:
        raise ValueError(
            f"Invalid LiDAR file: {bin_path}. "
            f"Expected multiple-of-4 float32 values, got {data.size}."
        )
    return data.reshape(-1, 4)


def load_labels(label_path: str | Path) -> Dict[str, np.ndarray]:
    """Load one SemanticKITTI label file.

    The lower 16 bits encode the semantic class ID; the upper 16 bits
    encode the instance ID.

    Returns
    -------
    dict with keys:
        raw       : uint32[N]  — raw 32-bit labels
        semantic  : uint16[N]  — raw semantic class IDs (before remapping)
        instance  : uint16[N]  — instance IDs
        training  : int64[N]   — remapped training class IDs (0-19)
    """
    label_path = Path(label_path)
    if not label_path.exists():
        raise FileNotFoundError(f"Label file not found: {label_path}")

    raw = np.fromfile(str(label_path), dtype=np.uint32)
    semantic = (raw & 0xFFFF).astype(np.uint16)
    instance = (raw >> 16).astype(np.uint16)
    training = remap_labels(semantic.astype(np.int64))

    return {
        "raw": raw,
        "semantic": semantic,
        "instance": instance,
        "training": training,
    }


def load_frame(
    bin_path: str | Path,
    label_path: Optional[str | Path] = None,
) -> Tuple[np.ndarray, Optional[Dict[str, np.ndarray]]]:
    """Load one complete LiDAR frame (scan + optional labels).

    Returns
    -------
    points : ndarray (N, 4)
    labels : dict or None
    """
    points = load_scan(bin_path)

    if label_path is None:
        return points, None

    labels = load_labels(label_path)

    if len(points) != len(labels["raw"]):
        raise ValueError(
            f"Point/label count mismatch:\n"
            f"  Points: {len(points)}\n"
            f"  Labels: {len(labels['raw'])}\n"
            f"  Scan:   {bin_path}\n"
            f"  Label:  {label_path}"
        )

    return points, labels


# ─────────────────────────────────────────────────────────────────────────
# Sequence enumeration
# ─────────────────────────────────────────────────────────────────────────

def list_sequences(velodyne_root: str | Path) -> List[str]:
    """Return sorted sequence IDs that have a velodyne/ subdirectory."""
    root = Path(velodyne_root)
    if not root.exists():
        return []
    seqs = []
    for child in sorted(root.iterdir()):
        if child.is_dir() and (child / "velodyne").is_dir():
            seqs.append(child.name)
    return seqs


def list_frames(
    velodyne_root: str | Path,
    sequence: str,
) -> List[int]:
    """Return sorted frame indices for a sequence."""
    vel_dir = Path(velodyne_root) / sequence / "velodyne"
    if not vel_dir.exists():
        return []
    return sorted(int(p.stem) for p in vel_dir.glob("*.bin"))


def frame_paths(
    velodyne_root: str | Path,
    label_root: str | Path,
    sequence: str,
    frame_id: int,
) -> Tuple[Path, Optional[Path]]:
    """Return (scan_path, label_path) for a frame.

    ``label_path`` is ``None`` if the label file does not exist.
    """
    scan = Path(velodyne_root) / sequence / "velodyne" / f"{frame_id:06d}.bin"
    label = Path(label_root) / sequence / "labels" / f"{frame_id:06d}.label"
    return scan, (label if label.exists() else None)


# ─────────────────────────────────────────────────────────────────────────
# Sequence iterator (for evaluation / streaming)
# ─────────────────────────────────────────────────────────────────────────

class SequenceIterator:
    """Iterate over all frames in a sequence, yielding (points, labels)."""

    def __init__(
        self,
        velodyne_root: str | Path,
        label_root: str | Path,
        sequence: str,
    ):
        self.velodyne_root = Path(velodyne_root)
        self.label_root = Path(label_root)
        self.sequence = sequence
        self.frame_ids = list_frames(velodyne_root, sequence)

    def __len__(self) -> int:
        return len(self.frame_ids)

    def __iter__(self):
        for fid in self.frame_ids:
            scan_path, label_path = frame_paths(
                self.velodyne_root,
                self.label_root,
                self.sequence,
                fid,
            )
            points, labels = load_frame(scan_path, label_path)
            yield fid, points, labels

    def __getitem__(self, idx: int):
        fid = self.frame_ids[idx]
        scan_path, label_path = frame_paths(
            self.velodyne_root,
            self.label_root,
            self.sequence,
            fid,
        )
        return fid, *load_frame(scan_path, label_path)
