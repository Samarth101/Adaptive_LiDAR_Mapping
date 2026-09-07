#!/usr/bin/env python3
"""
Export Predictions Script (for Colab / Kaggle)
================================================
Runs a segmentation model (Cylinder3D, MinkUNet, or PointNet++) on
SemanticKITTI sequences and saves per-frame predictions as .npz files.

These .npz files can then be loaded on a Mac (without CUDA) using the
``PrecomputedModelWrapper`` for the frontend demo.

Usage on Colab/Kaggle::

    # For Cylinder3D (requires spconv + CUDA)
    python scripts/export_predictions.py \\
        --model cylinder3d \\
        --checkpoint checkpoints/cylinder3d/cylinder3d_pretrained.pth \\
        --sequences 00 08 \\
        --output predictions/cylinder3d

    # For PointNet++ (works anywhere)
    python scripts/export_predictions.py \\
        --model pointnet2 \\
        --checkpoint checkpoints/pointnet2/pointnet2_semantickitti_ep29.pth \\
        --sequences 08 \\
        --output predictions/pointnet2

Transfer the ``predictions/`` folder to your Mac and the backend will
auto-detect and serve those predictions.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent.parent))
sys.path.insert(0, str(SCRIPT_DIR.parent))

from backend.config import BackendConfig
from backend.core.data_loader import SequenceIterator
from backend.models import create_model, get_available_models


def parse_args():
    parser = argparse.ArgumentParser(
        description="Export per-frame predictions to .npz files"
    )
    parser.add_argument(
        "--model", type=str, required=True,
        help="Model name: pointnet2, cylinder3d, minkuNet",
    )
    parser.add_argument(
        "--checkpoint", type=str, required=True,
        help="Path to model checkpoint",
    )
    parser.add_argument(
        "--sequences", type=str, nargs="+", default=["00", "08"],
        help="SemanticKITTI sequences to export",
    )
    parser.add_argument(
        "--output", type=str, default="predictions",
        help="Output directory (will contain model_name/seq/frame.npz)",
    )
    parser.add_argument(
        "--device", type=str, default="auto",
    )
    parser.add_argument(
        "--max-frames", type=int, default=0,
        help="Max frames per sequence (0 = all)",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    cfg = BackendConfig()

    print("=" * 60)
    print(f"  Export Predictions: {args.model}")
    print("=" * 60)
    print(f"  Checkpoint:  {args.checkpoint}")
    print(f"  Sequences:   {args.sequences}")
    print(f"  Output:      {args.output}")
    print(f"  Available:   {get_available_models()}")
    print()

    # Load model
    model = create_model(args.model, device=args.device)
    model.load_checkpoint(args.checkpoint)
    print(f"Model loaded: {model.get_model_name()} on {model.get_device()}")
    model.warmup()

    for seq in args.sequences:
        print(f"\n── Sequence {seq} ──")

        out_dir = Path(args.output) / seq
        out_dir.mkdir(parents=True, exist_ok=True)

        seq_iter = SequenceIterator(
            cfg.velodyne_root, cfg.label_root, seq
        )
        total = len(seq_iter)
        if args.max_frames > 0:
            total = min(total, args.max_frames)

        times = []
        for i, (fid, points, labels) in enumerate(seq_iter):
            if i >= total:
                break

            t0 = time.perf_counter()
            prediction = model.predict(points)
            elapsed_ms = (time.perf_counter() - t0) * 1000

            # Save prediction
            out_path = out_dir / f"{fid:06d}.npz"
            np.savez_compressed(
                str(out_path),
                semantic_ids=prediction.semantic_ids.astype(np.int16),
                confidences=prediction.confidences.astype(np.float16),
            )

            times.append(elapsed_ms)

            if (i + 1) % 100 == 0 or (i + 1) == total:
                avg_ms = np.mean(times[-100:])
                print(
                    f"  Frame {i + 1:5d}/{total} | "
                    f"{elapsed_ms:.0f} ms | "
                    f"avg {avg_ms:.0f} ms | "
                    f"saved {out_path.name}"
                )

        print(f"  Exported {len(times)} frames to {out_dir}")

    # Summary
    total_files = sum(
        len(list((Path(args.output) / s).glob("*.npz")))
        for s in args.sequences
    )
    total_size_mb = sum(
        f.stat().st_size
        for s in args.sequences
        for f in (Path(args.output) / s).glob("*.npz")
    ) / (1024 * 1024)

    print(f"\n{'=' * 60}")
    print(f"  Export complete!")
    print(f"  Files: {total_files}")
    print(f"  Size:  {total_size_mb:.1f} MB")
    print(f"  Copy the '{args.output}/' folder to your Mac")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
