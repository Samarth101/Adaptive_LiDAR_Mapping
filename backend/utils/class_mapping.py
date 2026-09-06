"""
Unified Semantic Class Mapping Utilities
=========================================
Single source of truth for SemanticKITTI class IDs, names, colors,
and the learning_map used across all three models.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import yaml


# ── 20-class learning map (from config/semantic-kitti.yaml) ──────────────
# Maps raw SemanticKITTI label IDs → training IDs 0-25.
# Class 0 = unlabeled / ignored.
LEARNING_MAP: Dict[int, int] = {
    0: 0, 1: 0, 10: 1, 11: 2, 13: 5, 15: 3, 16: 5, 18: 4, 20: 5,
    30: 6, 31: 7, 32: 8,
    40: 9, 44: 10, 48: 11, 49: 12,
    50: 13, 51: 14, 52: 0, 60: 9,
    70: 15, 71: 16, 72: 17, 80: 18, 81: 19,
    99: 0,
    252: 1, 253: 7, 254: 6, 255: 8,
    256: 5, 257: 5, 258: 4, 259: 5,
}

# Inverse map: training ID → canonical raw ID
LEARNING_MAP_INV: Dict[int, int] = {
    0: 0, 1: 10, 2: 11, 3: 15, 4: 18, 5: 20,
    6: 30, 7: 31, 8: 32,
    9: 40, 10: 44, 11: 48, 12: 49,
    13: 50, 14: 51, 15: 70, 16: 71, 17: 72,
    18: 80, 19: 81,
}

# ── Human-readable class names (training ID → name) ─────────────────────
CLASS_NAMES: Dict[int, str] = {
    0: "unlabeled",
    1: "car",
    2: "bicycle",
    3: "motorcycle",
    4: "truck",
    5: "other-vehicle",
    6: "person",
    7: "bicyclist",
    8: "motorcyclist",
    9: "road",
    10: "parking",
    11: "sidewalk",
    12: "other-ground",
    13: "building",
    14: "fence",
    15: "vegetation",
    16: "trunk",
    17: "terrain",
    18: "pole",
    19: "traffic-sign",
}

NUM_CLASSES = 20  # IDs 0–19; 0 = unlabeled/ignore

# ── Semantic categories for the project's three tasks ────────────────────
TERRAIN_CLASSES = {9, 10, 11, 12, 17}        # road, parking, sidewalk, other-ground, terrain
STATIC_OBSTACLE_CLASSES = {13, 14, 15, 16, 18, 19}  # building, fence, vegetation, trunk, pole, sign
DYNAMIC_OBJECT_CLASSES = {1, 2, 3, 4, 5, 6, 7, 8}   # car, bicycle, motorcycle, truck, …, motorcyclist

# ── Drivable vs non-drivable (Task 1) ───────────────────────────────────
DRIVABLE_CLASSES = {9, 10}           # road, parking
NON_DRIVABLE_CLASSES = (
    {11, 12, 17}                      # sidewalk, other-ground, terrain
    | STATIC_OBSTACLE_CLASSES
    | DYNAMIC_OBJECT_CLASSES
)

# ── RGB colors for visualization (training ID → (R, G, B) 0-255) ────────
CLASS_COLORS: Dict[int, Tuple[int, int, int]] = {
    0:  (0,   0,   0),       # unlabeled — black
    1:  (100, 150, 245),     # car — blue
    2:  (100, 230, 245),     # bicycle — cyan
    3:  (30,  60,  150),     # motorcycle — dark blue
    4:  (80,  30,  180),     # truck — purple
    5:  (0,   0,   255),     # other-vehicle — red
    6:  (255, 30,  30),      # person — bright red
    7:  (255, 40,  200),     # bicyclist — pink
    8:  (150, 30,  90),      # motorcyclist — maroon
    9:  (255, 0,   255),     # road — magenta
    10: (255, 150, 255),     # parking — light pink
    11: (75,  0,   75),      # sidewalk — dark magenta
    12: (175, 0,   75),      # other-ground — dark pink
    13: (255, 200, 0),       # building — orange-yellow
    14: (255, 120, 50),      # fence — orange
    15: (0,   175, 0),       # vegetation — green
    16: (135, 60,  0),       # trunk — brown
    17: (150, 240, 80),      # terrain — lime green
    18: (255, 240, 150),     # pole — pale yellow
    19: (255, 0,   0),       # traffic-sign — red
}


# ── Fast vectorised remapping ────────────────────────────────────────────

def build_remap_lut(max_raw_id: int = 260) -> np.ndarray:
    """Build a numpy look-up table for raw → training ID remapping.

    Usage::

        lut = build_remap_lut()
        training_labels = lut[raw_labels]
    """
    lut = np.zeros(max_raw_id, dtype=np.int64)
    for raw_id, train_id in LEARNING_MAP.items():
        if raw_id < max_raw_id:
            lut[raw_id] = train_id
    return lut


_REMAP_LUT: Optional[np.ndarray] = None


def remap_labels(raw_labels: np.ndarray) -> np.ndarray:
    """Remap raw SemanticKITTI labels to training IDs (vectorised)."""
    global _REMAP_LUT
    if _REMAP_LUT is None:
        _REMAP_LUT = build_remap_lut()
    # Clip values that might exceed our LUT size
    clipped = np.clip(raw_labels, 0, len(_REMAP_LUT) - 1)
    return _REMAP_LUT[clipped]


def class_name(training_id: int) -> str:
    """Return the human-readable name for a training class ID."""
    return CLASS_NAMES.get(training_id, f"unknown-{training_id}")


def class_color_rgb(training_id: int) -> Tuple[int, int, int]:
    """Return (R, G, B) color for a training class ID."""
    return CLASS_COLORS.get(training_id, (128, 128, 128))


def class_color_normalized(training_id: int) -> Tuple[float, float, float]:
    """Return (R, G, B) color in [0, 1] range."""
    r, g, b = class_color_rgb(training_id)
    return (r / 255.0, g / 255.0, b / 255.0)


def semantic_category(training_id: int) -> str:
    """Classify a training ID into terrain / static / dynamic / unlabeled."""
    if training_id == 0:
        return "unlabeled"
    if training_id in TERRAIN_CLASSES:
        return "terrain"
    if training_id in STATIC_OBSTACLE_CLASSES:
        return "static_obstacle"
    if training_id in DYNAMIC_OBJECT_CLASSES:
        return "dynamic_object"
    return "unknown"


def is_drivable(training_id: int) -> bool:
    """Return True if the class is considered drivable surface."""
    return training_id in DRIVABLE_CLASSES


def load_yaml_config(yaml_path: str) -> dict:
    """Load the official semantic-kitti.yaml and return parsed dict."""
    with open(yaml_path, "r") as f:
        return yaml.safe_load(f)


def get_class_weights(yaml_path: str) -> np.ndarray:
    """Compute inverse-frequency class weights from the YAML content field.

    Returns a float32 array of shape (NUM_CLASSES,) with weight for each
    training class.  Class 0 (unlabeled) gets weight 0.
    """
    cfg = load_yaml_config(yaml_path)
    content = cfg.get("content", {})

    # Accumulate per-training-class frequency
    freq = np.zeros(NUM_CLASSES, dtype=np.float64)
    for raw_id, ratio in content.items():
        train_id = LEARNING_MAP.get(raw_id, 0)
        if 0 < train_id < NUM_CLASSES:
            freq[train_id] += ratio

    # Inverse frequency weighting, avoid division by zero
    freq[freq == 0] = 1e-10
    weights = 1.0 / freq
    weights[0] = 0.0  # ignore unlabeled
    # Normalise so mean non-zero weight = 1
    nonzero = weights[weights > 0]
    if len(nonzero) > 0:
        weights[weights > 0] /= nonzero.mean()

    return weights.astype(np.float32)
