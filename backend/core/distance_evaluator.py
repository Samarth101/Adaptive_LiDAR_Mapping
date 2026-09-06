"""
Distance-based Evaluation Module
=================================
Computes per-distance-band accuracy and mIoU metrics for the frontend's
'Object Classification Accuracy by Distance' element.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from backend.config import BackendConfig
from backend.utils.class_mapping import NUM_CLASSES, CLASS_NAMES


@dataclass
class DistanceBandMetrics:
    """Metrics for a specific distance range from the sensor."""
    band_index: int
    min_distance: float
    max_distance: float
    point_count: int
    miou: float
    accuracy: float
    mean_confidence: float
    per_class_iou: Dict[int, float]
    per_class_count: Dict[int, int]


@dataclass
class EvaluationResult:
    """Complete evaluation result for a frame or sequence."""
    overall_miou: float
    overall_accuracy: float
    per_band: List[DistanceBandMetrics]
    confusion_matrix: np.ndarray
    per_class_iou: Dict[int, float]
    evaluation_ms: float


def compute_iou(
    pred: np.ndarray,
    gt: np.ndarray,
    num_classes: int = NUM_CLASSES,
    ignore_id: int = 0
) -> Tuple[Dict[int, float], float, np.ndarray, float]:
    """Compute per-class IoU, mIoU, and confusion matrix.
    
    Args:
        pred: Predicted class IDs [N]
        gt: Ground truth class IDs [N]
        num_classes: Total number of classes
        ignore_id: Class ID to ignore in evaluation
        
    Returns:
        Tuple of (per_class_iou, miou, confusion_matrix, accuracy)
    """
    valid_mask = gt != ignore_id
    pred_valid = pred[valid_mask]
    gt_valid = gt[valid_mask]

    # Compute confusion matrix
    cm = np.bincount(
        num_classes * gt_valid + pred_valid,
        minlength=num_classes ** 2
    ).reshape(num_classes, num_classes)

    # Compute IoU
    intersection = np.diag(cm)
    union = cm.sum(axis=1) + cm.sum(axis=0) - intersection
    
    # Avoid division by zero
    valid_classes = union > 0
    ious = np.full(num_classes, np.nan)
    ious[valid_classes] = intersection[valid_classes] / union[valid_classes]

    per_class_iou = {
        int(c): float(ious[c])
        for c in range(num_classes)
        if c != ignore_id and not np.isnan(ious[c])
    }

    # Mean IoU
    valid_ious = [iou for c, iou in per_class_iou.items()]
    miou = float(np.mean(valid_ious)) if valid_ious else float('nan')
    
    # Accuracy
    total_valid = cm.sum()
    accuracy = float(intersection.sum() / total_valid) if total_valid > 0 else float('nan')

    return per_class_iou, miou, cm, accuracy


def evaluate_frame(
    points: np.ndarray,
    pred_ids: np.ndarray,
    confidences: np.ndarray,
    gt_ids: Optional[np.ndarray] = None,
    distance_bands: Optional[List[Tuple[float, float]]] = None
) -> EvaluationResult:
    """Evaluate predictions against ground truth for a single frame.
    
    Args:
        points: Point coordinates [N, 3+]
        pred_ids: Predicted class IDs [N]
        confidences: Per-point confidence [N]
        gt_ids: Ground truth class IDs [N], optional
        distance_bands: List of (min_d, max_d) tuples, optional
        
    Returns:
        EvaluationResult containing overall and per-band metrics
    """
    start_time = time.perf_counter()
    
    if distance_bands is None:
        cfg = BackendConfig()
        distance_bands = cfg.distance_bands
        
    # Calculate horizontal distances (xy) or full 3d distance (xyz)
    distances = np.linalg.norm(points[:, :3], axis=1)
    
    per_band_metrics = []
    
    # Compute overall metrics if GT available
    if gt_ids is not None:
        overall_per_class_iou, overall_miou, overall_cm, overall_acc = compute_iou(
            pred_ids, gt_ids
        )
    else:
        overall_per_class_iou = {}
        overall_miou = float('nan')
        overall_acc = float('nan')
        overall_cm = np.zeros((NUM_CLASSES, NUM_CLASSES), dtype=np.int64)
        
    for i, (min_d, max_d) in enumerate(distance_bands):
        # Mask for points in this distance band
        band_mask = (distances >= min_d) & (distances < max_d)
        band_count = int(np.sum(band_mask))
        
        band_preds = pred_ids[band_mask]
        band_confs = confidences[band_mask]
        mean_conf = float(np.mean(band_confs)) if band_count > 0 else float('nan')
        
        if gt_ids is not None and band_count > 0:
            band_gts = gt_ids[band_mask]
            
            per_class_iou, miou, _, accuracy = compute_iou(band_preds, band_gts)
            
            # Per class counts
            valid_mask = band_gts != 0
            unique_classes, counts = np.unique(band_gts[valid_mask], return_counts=True)
            per_class_count = {int(k): int(v) for k, v in zip(unique_classes, counts)}
            
        else:
            miou = float('nan')
            accuracy = float('nan')
            per_class_iou = {}
            per_class_count = {}
            
        per_band_metrics.append(DistanceBandMetrics(
            band_index=i,
            min_distance=min_d,
            max_distance=max_d,
            point_count=band_count,
            miou=miou,
            accuracy=accuracy,
            mean_confidence=mean_conf,
            per_class_iou=per_class_iou,
            per_class_count=per_class_count
        ))
        
    eval_ms = (time.perf_counter() - start_time) * 1000.0
    
    return EvaluationResult(
        overall_miou=overall_miou,
        overall_accuracy=overall_acc,
        per_band=per_band_metrics,
        confusion_matrix=overall_cm,
        per_class_iou=overall_per_class_iou,
        evaluation_ms=eval_ms
    )


def evaluate_sequence(frame_results: List[EvaluationResult]) -> EvaluationResult:
    """Aggregate multiple frame results into a single result."""
    start_time = time.perf_counter()
    
    if not frame_results:
        raise ValueError("Cannot evaluate empty sequence")
        
    # Aggregate confusion matrix
    total_cm = np.zeros((NUM_CLASSES, NUM_CLASSES), dtype=np.int64)
    for res in frame_results:
        total_cm += res.confusion_matrix
        
    # Compute overall IoU from aggregate CM
    intersection = np.diag(total_cm)
    union = total_cm.sum(axis=1) + total_cm.sum(axis=0) - intersection
    
    valid_classes = union > 0
    ious = np.full(NUM_CLASSES, np.nan)
    ious[valid_classes] = intersection[valid_classes] / union[valid_classes]
    
    overall_per_class_iou = {
        int(c): float(ious[c])
        for c in range(NUM_CLASSES)
        if c != 0 and not np.isnan(ious[c])
    }
    
    valid_ious = [iou for c, iou in overall_per_class_iou.items()]
    overall_miou = float(np.mean(valid_ious)) if valid_ious else float('nan')
    
    total_valid = total_cm.sum()
    overall_acc = float(intersection.sum() / total_valid) if total_valid > 0 else float('nan')
    
    # We could aggregate per-band confusion matrices too, but for simplicity
    # and given the specs, we just average the per-band metrics if needed,
    # or recreate them from accumulated per-band CMs.
    # To do it properly, we should accumulate CMs per band.
    # However, since `EvaluationResult` doesn't store per-band CMs, 
    # we'll approximate by averaging the metrics for now, weighted by point counts.
    
    num_bands = len(frame_results[0].per_band)
    agg_bands = []
    
    for i in range(num_bands):
        total_pts = 0
        sum_acc = 0.0
        sum_miou = 0.0
        sum_conf = 0.0
        valid_miou_count = 0
        valid_acc_count = 0
        
        agg_per_class_count = {}
        
        for res in frame_results:
            band = res.per_band[i]
            pts = band.point_count
            total_pts += pts
            
            if not np.isnan(band.mean_confidence):
                sum_conf += band.mean_confidence * pts
                
            if not np.isnan(band.accuracy):
                sum_acc += band.accuracy * pts
                valid_acc_count += pts
                
            if not np.isnan(band.miou):
                sum_miou += band.miou * pts
                valid_miou_count += pts
                
            for cls_id, count in band.per_class_count.items():
                agg_per_class_count[cls_id] = agg_per_class_count.get(cls_id, 0) + count
                
        # We don't have aggregated per-class IoU for bands unless we store CMs,
        # leaving empty for aggregated sequence result.
        
        agg_bands.append(DistanceBandMetrics(
            band_index=i,
            min_distance=frame_results[0].per_band[i].min_distance,
            max_distance=frame_results[0].per_band[i].max_distance,
            point_count=total_pts,
            miou=sum_miou / valid_miou_count if valid_miou_count > 0 else float('nan'),
            accuracy=sum_acc / valid_acc_count if valid_acc_count > 0 else float('nan'),
            mean_confidence=sum_conf / total_pts if total_pts > 0 else float('nan'),
            per_class_iou={},  # Omitted for sequence aggregation without band CMs
            per_class_count=agg_per_class_count
        ))
        
    eval_ms = (time.perf_counter() - start_time) * 1000.0
    
    return EvaluationResult(
        overall_miou=overall_miou,
        overall_accuracy=overall_acc,
        per_band=agg_bands,
        confusion_matrix=total_cm,
        per_class_iou=overall_per_class_iou,
        evaluation_ms=eval_ms
    )


def format_report(result: EvaluationResult) -> str:
    """Format the evaluation result as a console-friendly string."""
    lines = [
        "================================================",
        "          Evaluation Results Summary            ",
        "================================================",
        f"Overall mIoU:     {result.overall_miou * 100:.2f}%" if not np.isnan(result.overall_miou) else "Overall mIoU:     N/A",
        f"Overall Accuracy: {result.overall_accuracy * 100:.2f}%" if not np.isnan(result.overall_accuracy) else "Overall Accuracy: N/A",
        f"Evaluation Time:  {result.evaluation_ms:.2f} ms",
        "",
        "Distance Band Metrics:",
        "------------------------------------------------"
    ]
    
    for band in result.per_band:
        lines.append(f"Band {band.band_index} ({band.min_distance:.1f}m - {band.max_distance:.1f}m):")
        lines.append(f"  Points:     {band.point_count}")
        
        if not np.isnan(band.mean_confidence):
            lines.append(f"  Mean Conf:  {band.mean_confidence:.3f}")
        else:
            lines.append("  Mean Conf:  N/A")
            
        if not np.isnan(band.miou):
            lines.append(f"  mIoU:       {band.miou * 100:.2f}%")
        else:
            lines.append("  mIoU:       N/A")
            
        if not np.isnan(band.accuracy):
            lines.append(f"  Accuracy:   {band.accuracy * 100:.2f}%")
        else:
            lines.append("  Accuracy:   N/A")
            
        lines.append("")
        
    lines.append("Per-Class IoU (Overall):")
    lines.append("------------------------------------------------")
    
    for cls_id, iou in sorted(result.per_class_iou.items()):
        cls_name = CLASS_NAMES.get(cls_id, f"Class {cls_id}")
        lines.append(f"  {cls_name:<20} {iou * 100:.2f}%")
        
    lines.append("================================================")
    return "\n".join(lines)
