"""
Frame Processor Pipeline
==========================
Orchestrates the end-to-end pipeline for a single LiDAR frame:

    Raw .bin → Load → Model Inference → Adaptive Grid
             → Elevation → Distance Metrics → FrameData (ready for serialization)

This is the main integration point between all backend components.
"""

from __future__ import annotations

import logging
import time

import math
from pathlib import Path
from sklearn.cluster import DBSCAN

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from backend.config import BackendConfig, DEFAULT_RESOLUTION_BANDS, DEFAULT_DISTANCE_BANDS
from backend.core.adaptive_grid import AdaptiveCell, build_adaptive_grid, grid_to_arrays
from backend.core.data_loader import load_frame, load_scan
from backend.core.distance_evaluator import EvaluationResult, evaluate_frame
from backend.core.elevation import process_elevation, estimate_ground_plane, compute_height_above_ground
from backend.models.base import BaseSegmentationModel, ModelPrediction
from backend.serialization.binary_frame import FrameData
from backend.utils.class_mapping import remap_labels

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────
# Result containers
# ─────────────────────────────────────────────────────────────────────────

def parse_pose(label_root: str, sequence: str, frame_id: int) -> tuple[float, float, float]:
    pose_path = Path(label_root).parent / "sequences" / sequence / "poses.txt"
    if not pose_path.exists():
        return 0.0, 0.0, 0.0
    try:
        with open(pose_path, "r") as f:
            for i, line in enumerate(f):
                if i == frame_id:
                    vals = [float(v) for v in line.strip().split()]
                    tx, ty, tz = vals[3], vals[7], vals[11]
                    r11, r21 = vals[0], vals[4]
                    heading = math.atan2(r21, r11)
                    return float(tx), float(tz), float(heading)
    except Exception:
        pass
    return 0.0, 0.0, 0.0

@dataclass
class FrameResult:
    """Complete processed result for a single LiDAR frame."""

    # Metadata
    frame_id: int
    sequence: str
    ego_x: float
    ego_y: float
    ego_heading: float
    model_name: str
    timestamp: float

    # Raw data
    points: np.ndarray          # [N, 4] float32 — x, y, z, intensity
    num_points: int

    # Model prediction
    prediction: ModelPrediction

    # Adaptive grid
    cells: List[AdaptiveCell]
    num_cells: int
    
    # Elevation data
    elevation_data: Dict[str, np.ndarray]

    # Distance-band evaluation
    evaluation: Optional[EvaluationResult]

    # Timing breakdown (ms)
    load_ms: float
    inference_ms: float
    grid_ms: float
    elevation_ms: float
    evaluation_ms: float
    total_ms: float

    # Derived
    fps: float
    compression_ratio: float    # points / cells
    objects: list = field(default_factory=list)


@dataclass
class PipelineState:
    """Mutable state for the pipeline (current model, config, etc.)."""
    config: BackendConfig
    model: Optional[BaseSegmentationModel] = None
    model_name: str = ""
    frames_processed: int = 0


# ─────────────────────────────────────────────────────────────────────────
# Frame Processor
# ─────────────────────────────────────────────────────────────────────────

class FrameProcessor:
    """Stateful pipeline that processes LiDAR frames end-to-end.

    Usage::

        fp = FrameProcessor(config=BackendConfig())
        fp.set_model(model_instance)
        result = fp.process_frame("data/sequences/00/velodyne/000000.bin")
    """

    def __init__(self, config: Optional[BackendConfig] = None):
        self.config = config or BackendConfig()
        self._model: Optional[BaseSegmentationModel] = None
        self._model_name: str = ""
        self._frames_processed: int = 0

    # ── Model management ────────────────────────────────────────────────

    def set_model(self, model: BaseSegmentationModel) -> None:
        """Set the active segmentation model."""
        self._model = model
        self._model_name = model.get_model_name()
        logger.info(f"FrameProcessor: Active model set to '{self._model_name}'")

    def get_model(self) -> Optional[BaseSegmentationModel]:
        return self._model

    def get_model_name(self) -> str:
        return self._model_name

    # ── Main pipeline ───────────────────────────────────────────────────

    def process_frame(
        self,
        scan_path: str,
        label_path: Optional[str] = None,
        frame_id: int = 0,
        sequence: str = "00",
        include_raw_points: bool = True,
        include_elevation: bool = True,
        include_evaluation: bool = True,
        max_raw_points: int = 0,
    ) -> FrameResult:
        """Run the complete pipeline on a single frame.

        Args:
            scan_path: Path to .bin velodyne scan.
            label_path: Optional path to .label ground-truth file.
            frame_id: Frame index (for metadata).
            sequence: Sequence ID (for metadata).
            include_raw_points: Include raw xyz in output (for live point cloud).
            include_elevation: Compute elevation data.
            include_evaluation: Compute distance-band metrics (needs GT or confidence).
            max_raw_points: If >0, subsample raw points for transport (0=all).

        Returns:
            FrameResult with all computed data and timing info.
        """
        if self._model is None:
            raise RuntimeError(
                "No model set. Call set_model() before process_frame()."
            )

        t_total_start = time.perf_counter()

        # ── 1. Load frame ────────────────────────────────────────────
        t0 = time.perf_counter()
        points, labels = load_frame(scan_path, label_path)
        load_ms = (time.perf_counter() - t0) * 1000.0

        N = len(points)

        # Get ground truth training labels if available
        gt_ids = labels["training"] if labels is not None else None

        # ── 2. Model inference ───────────────────────────────────────
        # If using PrecomputedModelWrapper, set frame context first
        from backend.models.precomputed_wrapper import PrecomputedModelWrapper
        if isinstance(self._model, PrecomputedModelWrapper):
            self._model.set_frame_context(sequence, frame_id)

        prediction = self._model.predict(points)
        inference_ms = prediction.inference_ms

        # ── 3. Build adaptive grid ───────────────────────────────────
        t0 = time.perf_counter()
        cells = build_adaptive_grid(
            points=points[:, :3],
            semantic_ids=prediction.semantic_ids,
            confidences=prediction.confidences,
            bands=self.config.resolution_bands,
        )
        grid_ms = (time.perf_counter() - t0) * 1000.0

        # ── 4. Elevation processing ──────────────────────────────────
        t0 = time.perf_counter()
        if include_elevation and cells:
            elevation_data = process_elevation(cells)
        else:
            elevation_data = {}
        elevation_ms = (time.perf_counter() - t0) * 1000.0

        # ── 5. Distance-band evaluation ──────────────────────────────
        t0 = time.perf_counter()
        evaluation = None
        if include_evaluation:
            evaluation = evaluate_frame(
                points=points[:, :3],
                pred_ids=prediction.semantic_ids,
                confidences=prediction.confidences,
                gt_ids=gt_ids,
                distance_bands=self.config.distance_bands,
            )
        evaluation_ms = (time.perf_counter() - t0) * 1000.0

        # ── Totals ───────────────────────────────────────────────────
        total_ms = (time.perf_counter() - t_total_start) * 1000.0
        fps = 1000.0 / total_ms if total_ms > 0 else 0.0
        compression = N / len(cells) if cells else 0.0

        fps = 1000.0 / total_ms if total_ms > 0 else 0.0
        compression = N / len(cells) if cells else 0.0

        # Extract pose
        ego_x, ego_y, ego_heading = parse_pose(self.config.label_root, sequence, frame_id)

        # Detect objects via DBSCAN on raw points for accurate bounding boxes
        from backend.utils.class_mapping import DYNAMIC_OBJECT_CLASSES
        objects = []
        
        # Filter raw points that belong to dynamic classes
        mask = np.isin(prediction.semantic_ids, list(DYNAMIC_OBJECT_CLASSES))
        dyn_pts = points[mask, :3]
        dyn_classes = prediction.semantic_ids[mask]
        
        if len(dyn_pts) > 0:
            clustering = DBSCAN(eps=0.8, min_samples=5).fit(dyn_pts)
            labels = clustering.labels_
            n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
            
            for k in range(n_clusters):
                cluster_mask = labels == k
                cluster_pts = dyn_pts[cluster_mask]
                
                # Get the most frequent class in the cluster
                from collections import Counter
                cluster_cls = Counter(dyn_classes[cluster_mask]).most_common(1)[0][0]
                
                # Compute dimensions with percentiles to ignore noise
                p_low = np.percentile(cluster_pts, 5, axis=0)
                p_high = np.percentile(cluster_pts, 95, axis=0)
                
                cx, cy, cz = cluster_pts.mean(axis=0)
                l = max(p_high[0] - p_low[0], 0.3)  # min size 0.3m
                w = max(p_high[1] - p_low[1], 0.3)
                h = max(p_high[2] - p_low[2], 0.3)
                
                objects.append({
                    "id": k,
                    "type": int(cluster_cls),
                    "cx": float(cx), "cy": float(cy), "cz": float(cz),
                    "l": float(l), "w": float(w), "h": float(h),
                    "heading": 0.0,
                    "conf": 1.0
                })

        self._frames_processed += 1

        return FrameResult(
            frame_id=frame_id,
            sequence=sequence,
            model_name=self._model_name,
            timestamp=time.time(),
            ego_x=ego_x, ego_y=ego_y, ego_heading=ego_heading,
            objects=objects,
            points=points,
            num_points=N,
            prediction=prediction,
            cells=cells,
            num_cells=len(cells),
            elevation_data=elevation_data,
            evaluation=evaluation,
            load_ms=load_ms,
            inference_ms=inference_ms,
            grid_ms=grid_ms,
            elevation_ms=elevation_ms,
            evaluation_ms=evaluation_ms,
            total_ms=total_ms,
            fps=fps,
            compression_ratio=compression,
        )

    # ── Convert to FrameData for serialization ──────────────────────────

    def result_to_frame_data(
        self,
        result: FrameResult,
        include_raw_points: bool = True,
        include_elevation: bool = True,
        include_distance_metrics: bool = True,
        max_raw_points: int = 50000,
    ) -> FrameData:
        """Convert a FrameResult to FrameData for binary/JSON serialization.

        Args:
            result: Processed frame result.
            include_raw_points: Include downsampled raw points for live view.
            include_elevation: Include elevation arrays.
            include_distance_metrics: Include per-band metrics.
            max_raw_points: Subsample raw points if they exceed this count.
        """
        cells = result.cells

        # Cell arrays
        cell_x = np.array([c.x for c in cells], dtype=np.float32)
        cell_y = np.array([c.y for c in cells], dtype=np.float32)
        cell_res = np.array([c.resolution for c in cells], dtype=np.float32)
        cell_sem = np.array([c.semantic_id for c in cells], dtype=np.uint16)
        cell_conf = np.array([c.semantic_confidence for c in cells], dtype=np.float32)
        cell_obj_h = np.array([c.object_height for c in cells], dtype=np.float32)
        cell_gnd = np.array([c.ground_elevation for c in cells], dtype=np.float32)
        cell_cnt = np.array([c.point_count for c in cells], dtype=np.uint32)

        frame_data = FrameData(
            frame_id=result.frame_id,
            timestamp=result.timestamp,
            ego_x=result.ego_x,
            ego_y=result.ego_y,
            ego_heading=result.ego_heading,
            cell_x=cell_x,
            cell_y=cell_y,
            cell_resolution=cell_res,
            cell_semantic_id=cell_sem,
            cell_confidence=cell_conf,
            cell_object_height=cell_obj_h,
            cell_ground_elev=cell_gnd,
            cell_point_count=cell_cnt,
        )
        
        if result.objects:
            frame_data.obj_id = np.array([o['id'] for o in result.objects], dtype=np.uint32)
            frame_data.obj_type = np.array([o['type'] for o in result.objects], dtype=np.uint16)
            frame_data.obj_cx = np.array([o['cx'] for o in result.objects], dtype=np.float32)
            frame_data.obj_cy = np.array([o['cy'] for o in result.objects], dtype=np.float32)
            frame_data.obj_cz = np.array([o['cz'] for o in result.objects], dtype=np.float32)
            frame_data.obj_l = np.array([o['l'] for o in result.objects], dtype=np.float32)
            frame_data.obj_w = np.array([o['w'] for o in result.objects], dtype=np.float32)
            frame_data.obj_h = np.array([o['h'] for o in result.objects], dtype=np.float32)
            frame_data.obj_heading = np.array([o['heading'] for o in result.objects], dtype=np.float32)
            frame_data.obj_conf = np.array([o['conf'] for o in result.objects], dtype=np.float32)


        # ── Raw points ───────────────────────────────────────────────
        if include_raw_points:
            pts = result.points
            pred = result.prediction

            # Subsample if too many points
            if max_raw_points > 0 and len(pts) > max_raw_points:
                idx = np.random.choice(len(pts), max_raw_points, replace=False)
                idx.sort()
                pts = pts[idx]
                sem = pred.semantic_ids[idx]
                conf = pred.confidences[idx]
            else:
                sem = pred.semantic_ids
                conf = pred.confidences

            frame_data.raw_x = pts[:, 0].astype(np.float32)
            frame_data.raw_y = pts[:, 1].astype(np.float32)
            frame_data.raw_z = pts[:, 2].astype(np.float32)
            frame_data.raw_semantic_id = sem.astype(np.uint16)
            frame_data.raw_confidence = conf.astype(np.float32)

        # ── Elevation ────────────────────────────────────────────────
        if include_elevation and result.elevation_data:
            frame_data.cell_mean_height = np.array(
                [c.mean_height for c in cells], dtype=np.float32
            )
            frame_data.cell_height_var = np.array(
                [c.height_variance for c in cells], dtype=np.float32
            )

        # ── Distance metrics ─────────────────────────────────────────
        if include_distance_metrics and result.evaluation is not None:
            ev = result.evaluation
            n_bands = len(ev.per_band)
            frame_data.band_miou = np.array(
                [b.miou for b in ev.per_band], dtype=np.float32
            )
            frame_data.band_accuracy = np.array(
                [b.accuracy for b in ev.per_band], dtype=np.float32
            )
            frame_data.band_point_count = np.array(
                [b.point_count for b in ev.per_band], dtype=np.uint32
            )
            frame_data.band_mean_conf = np.array(
                [b.mean_confidence for b in ev.per_band], dtype=np.float32
            )

        return frame_data

    # ── Convenience ─────────────────────────────────────────────────────

    def process_and_serialize(
        self,
        scan_path: str,
        label_path: Optional[str] = None,
        frame_id: int = 0,
        sequence: str = "00",
        fmt: str = "binary",
    ) -> bytes | str:
        """Process a frame and return serialized data.

        Args:
            fmt: 'binary' or 'json'.
        """
        from backend.serialization.binary_frame import serialize_binary, serialize_json

        result = self.process_frame(
            scan_path, label_path, frame_id, sequence
        )
        frame_data = self.result_to_frame_data(result)

        if fmt == "json":
            return serialize_json(frame_data)
        else:
            return serialize_binary(frame_data)
