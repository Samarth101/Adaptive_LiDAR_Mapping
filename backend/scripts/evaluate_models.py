#!/usr/bin/env python3
"""
Multi-Model Evaluation Script
===============================
Evaluates one or more segmentation models on SemanticKITTI validation
(or any specified sequence), producing per-model and per-distance-band
mIoU, accuracy, and confusion matrices.

Usage::

    python scripts/evaluate_models.py --models pointnet2,cylinder3d --seq 08
    python scripts/evaluate_models.py --models pointnet2 --seq 08 --max-frames 50
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

# Add project root and backend directory to path
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent.parent))
sys.path.insert(0, str(SCRIPT_DIR.parent))

from backend.config import BackendConfig, DEFAULT_DISTANCE_BANDS
from backend.core.data_loader import SequenceIterator
from backend.core.distance_evaluator import evaluate_frame, evaluate_sequence, format_report
from backend.models import create_model, get_available_models
from backend.utils.class_mapping import remap_labels, CLASS_NAMES


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate segmentation models on SemanticKITTI"
    )
    parser.add_argument(
        "--models",
        type=str,
        default="pointnet2",
        help="Comma-separated model names (e.g. 'pointnet2,cylinder3d')",
    )
    parser.add_argument(
        "--seq",
        type=str,
        default="08",
        help="SemanticKITTI sequence to evaluate on (default: 08 = validation)",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=0,
        help="Max frames to evaluate (0 = all)",
    )
    parser.add_argument(
        "--checkpoint-dir",
        type=str,
        default="",
        help="Override checkpoint directory",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="",
        help="Path to save JSON results (optional)",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="auto",
        help="Device: auto | cuda | mps | cpu",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    cfg = BackendConfig()

    if args.checkpoint_dir:
        cfg.checkpoint_dir = args.checkpoint_dir

    model_names = [m.strip() for m in args.models.split(",")]
    available = get_available_models()

    print("=" * 70)
    print("  SIH26053 — Multi-Model Evaluation")
    print("=" * 70)
    print(f"  Available models: {available}")
    print(f"  Requested models: {model_names}")
    print(f"  Sequence:         {args.seq}")
    print(f"  Device:           {args.device}")
    print("=" * 70)
    print()

    # ── Load sequence ────────────────────────────────────────────────────
    seq_iter = SequenceIterator(
        cfg.velodyne_root,
        cfg.label_root,
        args.seq,
    )
    total_frames = len(seq_iter)
    if args.max_frames > 0:
        total_frames = min(total_frames, args.max_frames)

    print(f"Frames to evaluate: {total_frames}")
    print()

    # ── Evaluate each model ──────────────────────────────────────────────
    all_results = {}

    for model_name in model_names:
        if model_name not in available:
            print(f"⚠️  Model '{model_name}' not available. Skipping.")
            continue

        print(f"{'─' * 70}")
        print(f"  Evaluating: {model_name}")
        print(f"{'─' * 70}")

        # Instantiate model
        model = create_model(model_name, device=args.device)

        # Find checkpoint
        ckpt_dir = Path(cfg.checkpoint_dir) / model_name
        ckpt_files = sorted(ckpt_dir.glob("*.pth")) + sorted(ckpt_dir.glob("*.pt"))
        if not ckpt_files:
            print(f"  ❌ No checkpoint found in {ckpt_dir}")
            print(f"     Place weights in: {ckpt_dir}/")
            print()
            continue

        ckpt_path = str(ckpt_files[-1])  # latest
        print(f"  Checkpoint: {ckpt_path}")

        try:
            model.load_checkpoint(ckpt_path)
        except Exception as exc:
            print(f"  ❌ Failed to load checkpoint: {exc}")
            continue

        # Warmup
        model.warmup()

        # Evaluate frames
        frame_results = []
        total_inference_ms = 0.0

        for i, (fid, points, labels) in enumerate(seq_iter):
            if i >= total_frames:
                break

            # Get ground truth training labels
            gt_ids = labels["training"] if labels is not None else None

            # Run model prediction
            prediction = model.predict(points)
            total_inference_ms += prediction.inference_ms

            # Evaluate this frame
            frame_eval = evaluate_frame(
                points=points[:, :3],
                pred_ids=prediction.semantic_ids,
                confidences=prediction.confidences,
                gt_ids=gt_ids,
                distance_bands=DEFAULT_DISTANCE_BANDS,
            )
            frame_results.append(frame_eval)

            if (i + 1) % 50 == 0 or (i + 1) == total_frames:
                avg_ms = total_inference_ms / (i + 1)
                print(
                    f"  Frame {i + 1:4d}/{total_frames} | "
                    f"Avg inference: {avg_ms:.1f} ms | "
                    f"Frame mIoU: {frame_eval.overall_miou:.3f}"
                )

        if not frame_results:
            print("  No frames evaluated.")
            continue

        # Aggregate results
        agg = evaluate_sequence(frame_results)

        print()
        print(format_report(agg))

        # Store results
        all_results[model_name] = {
            "overall_miou": float(agg.overall_miou),
            "overall_accuracy": float(agg.overall_accuracy),
            "avg_inference_ms": total_inference_ms / len(frame_results),
            "fps": 1000.0 / (total_inference_ms / len(frame_results)),
            "frames_evaluated": len(frame_results),
            "per_band": [
                {
                    "band": f"{b.min_distance:.0f}-{b.max_distance:.0f}m",
                    "miou": float(b.miou) if not np.isnan(b.miou) else None,
                    "accuracy": float(b.accuracy) if not np.isnan(b.accuracy) else None,
                    "mean_confidence": float(b.mean_confidence),
                    "point_count": int(b.point_count),
                }
                for b in agg.per_band
            ],
            "per_class_iou": {
                CLASS_NAMES.get(k, str(k)): float(v)
                for k, v in agg.per_class_iou.items()
            },
        }

    # ── Comparison summary ───────────────────────────────────────────────
    if len(all_results) > 1:
        print()
        print("=" * 70)
        print("  MODEL COMPARISON")
        print("=" * 70)
        header = f"{'Model':<15} {'mIoU':>8} {'Accuracy':>10} {'FPS':>8} {'Frames':>8}"
        print(header)
        print("-" * len(header))
        for name, res in all_results.items():
            print(
                f"{name:<15} "
                f"{res['overall_miou']:>8.3f} "
                f"{res['overall_accuracy']:>10.3f} "
                f"{res['fps']:>8.1f} "
                f"{res['frames_evaluated']:>8d}"
            )
        print()

    # ── Save results ─────────────────────────────────────────────────────
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(all_results, f, indent=2)
        print(f"Results saved to: {output_path}")

    print("Evaluation complete.")


if __name__ == "__main__":
    main()
