#!/usr/bin/env python3
"""
Performance Benchmark Script
==============================
Measures inference latency, mapping latency, end-to-end FPS, memory usage,
and compression ratio for each available model.

Usage::

    python scripts/benchmark.py --models pointnet2,cylinder3d --frames 100
    python scripts/benchmark.py --models pointnet2 --seq 00 --warmup 5
"""

from __future__ import annotations

import argparse
import gc
import json
import sys
import time
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent.parent))
sys.path.insert(0, str(SCRIPT_DIR.parent))

from backend.config import BackendConfig, DEFAULT_RESOLUTION_BANDS
from backend.core.data_loader import SequenceIterator
from backend.core.adaptive_grid import build_adaptive_grid
from backend.models import create_model, get_available_models
from backend.serialization.binary_frame import FrameData, serialize_binary


def parse_args():
    parser = argparse.ArgumentParser(description="Benchmark LiDAR pipeline")
    parser.add_argument("--models", type=str, default="pointnet2")
    parser.add_argument("--seq", type=str, default="00")
    parser.add_argument("--frames", type=int, default=100)
    parser.add_argument("--warmup", type=int, default=3)
    parser.add_argument("--device", type=str, default="auto")
    parser.add_argument("--output", type=str, default="")
    return parser.parse_args()


def get_gpu_memory_mb() -> float:
    """Return current GPU memory usage in MB (PyTorch CUDA only)."""
    try:
        import torch
        if torch.cuda.is_available():
            return torch.cuda.memory_allocated() / (1024 * 1024)
    except Exception:
        pass
    return 0.0


def sizeof_fmt(num_bytes: float) -> str:
    """Human-readable byte size."""
    for unit in ("B", "KB", "MB", "GB"):
        if abs(num_bytes) < 1024.0:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} TB"


def main():
    args = parse_args()
    cfg = BackendConfig()

    model_names = [m.strip() for m in args.models.split(",")]
    available = get_available_models()

    print("=" * 70)
    print("  SIH26053 — Performance Benchmark")
    print("=" * 70)
    print(f"  Models:   {model_names}")
    print(f"  Sequence: {args.seq}")
    print(f"  Frames:   {args.frames}")
    print(f"  Warmup:   {args.warmup}")
    print("=" * 70)
    print()

    # Load sequence
    seq_iter = SequenceIterator(cfg.velodyne_root, cfg.label_root, args.seq)
    total_frames = min(len(seq_iter), args.frames + args.warmup)

    all_benchmarks = {}

    for model_name in model_names:
        if model_name not in available:
            print(f"⚠️  Model '{model_name}' not available. Skipping.")
            continue

        print(f"{'─' * 70}")
        print(f"  Benchmarking: {model_name}")
        print(f"{'─' * 70}")

        # Instantiate
        model = create_model(model_name, device=args.device)

        # Find checkpoint
        ckpt_dir = Path(cfg.checkpoint_dir) / model_name
        ckpt_files = sorted(ckpt_dir.glob("*.pth")) + sorted(ckpt_dir.glob("*.pt"))
        if not ckpt_files:
            print(f"  ❌ No checkpoint found in {ckpt_dir}")
            continue

        model.load_checkpoint(str(ckpt_files[-1]))
        model.warmup()
        gc.collect()

        # Benchmark arrays
        inference_times = []
        mapping_times = []
        e2e_times = []
        point_counts = []
        cell_counts = []
        frame_bytes_raw = []
        frame_bytes_adaptive = []
        frame_bytes_binary = []

        mem_before = get_gpu_memory_mb()

        for i, (fid, points, labels) in enumerate(seq_iter):
            if i >= total_frames:
                break

            N = len(points)

            # ── End-to-end timing ────────────────────────────────────
            t_start = time.perf_counter()

            # Inference
            t_infer_start = time.perf_counter()
            prediction = model.predict(points)
            t_infer_end = time.perf_counter()

            # Adaptive mapping
            t_map_start = time.perf_counter()
            cells = build_adaptive_grid(
                points=points[:, :3],
                semantic_ids=prediction.semantic_ids,
                confidences=prediction.confidences,
                bands=DEFAULT_RESOLUTION_BANDS,
            )
            t_map_end = time.perf_counter()

            t_end = time.perf_counter()

            # Skip warmup frames
            if i < args.warmup:
                continue

            infer_ms = (t_infer_end - t_infer_start) * 1000
            map_ms = (t_map_end - t_map_start) * 1000
            e2e_ms = (t_end - t_start) * 1000

            inference_times.append(infer_ms)
            mapping_times.append(map_ms)
            e2e_times.append(e2e_ms)
            point_counts.append(N)
            cell_counts.append(len(cells))

            # Memory comparison
            raw_bytes = N * 4 * 4  # N points × 4 floats × 4 bytes
            # Adaptive cell: ~40 bytes per cell (10 float/int fields × 4 bytes)
            adaptive_bytes = len(cells) * 40
            frame_bytes_raw.append(raw_bytes)
            frame_bytes_adaptive.append(adaptive_bytes)

            # Binary frame size
            frame_data = FrameData(
                frame_id=fid,
                timestamp=time.time(),
                cell_x=np.array([c.x for c in cells], dtype=np.float32),
                cell_y=np.array([c.y for c in cells], dtype=np.float32),
                cell_resolution=np.array([c.resolution for c in cells], dtype=np.float32),
                cell_semantic_id=np.array([c.semantic_id for c in cells], dtype=np.uint16),
                cell_confidence=np.array([c.semantic_confidence for c in cells], dtype=np.float32),
                cell_object_height=np.array([c.object_height for c in cells], dtype=np.float32),
                cell_ground_elev=np.array([c.ground_elevation for c in cells], dtype=np.float32),
                cell_point_count=np.array([c.point_count for c in cells], dtype=np.uint32),
            )
            binary_data = serialize_binary(frame_data)
            frame_bytes_binary.append(len(binary_data))

            if (i - args.warmup + 1) % 20 == 0:
                print(
                    f"  Frame {i - args.warmup + 1:4d} | "
                    f"Infer: {infer_ms:6.1f} ms | "
                    f"Map: {map_ms:5.1f} ms | "
                    f"E2E: {e2e_ms:6.1f} ms | "
                    f"Points: {N:6d} → Cells: {len(cells):5d}"
                )

        mem_after = get_gpu_memory_mb()

        if not inference_times:
            print("  No frames benchmarked (need more frames than warmup).")
            continue

        # ── Aggregate statistics ─────────────────────────────────────
        results = {
            "model": model_name,
            "device": model.get_device(),
            "frames": len(inference_times),
            "inference_ms": {
                "mean": float(np.mean(inference_times)),
                "std": float(np.std(inference_times)),
                "min": float(np.min(inference_times)),
                "max": float(np.max(inference_times)),
                "p50": float(np.percentile(inference_times, 50)),
                "p95": float(np.percentile(inference_times, 95)),
            },
            "mapping_ms": {
                "mean": float(np.mean(mapping_times)),
                "std": float(np.std(mapping_times)),
            },
            "e2e_ms": {
                "mean": float(np.mean(e2e_times)),
                "std": float(np.std(e2e_times)),
            },
            "fps": float(1000.0 / np.mean(e2e_times)),
            "points_per_frame": {
                "mean": int(np.mean(point_counts)),
                "std": int(np.std(point_counts)),
            },
            "cells_per_frame": {
                "mean": int(np.mean(cell_counts)),
                "std": int(np.std(cell_counts)),
            },
            "compression_ratio": float(
                np.mean(point_counts) / np.mean(cell_counts)
            ),
            "memory": {
                "raw_bytes_per_frame": sizeof_fmt(np.mean(frame_bytes_raw)),
                "adaptive_bytes_per_frame": sizeof_fmt(np.mean(frame_bytes_adaptive)),
                "binary_frame_bytes": sizeof_fmt(np.mean(frame_bytes_binary)),
                "memory_reduction_pct": float(
                    (1 - np.mean(frame_bytes_adaptive) / np.mean(frame_bytes_raw))
                    * 100
                ),
                "gpu_vram_mb": float(mem_after),
            },
        }

        all_benchmarks[model_name] = results

        # Print summary
        print()
        print(f"  ┌───────────────────────────────────────────────────")
        print(f"  │ {model_name} Benchmark Summary")
        print(f"  ├───────────────────────────────────────────────────")
        print(f"  │ Inference:     {results['inference_ms']['mean']:.1f} ± {results['inference_ms']['std']:.1f} ms")
        print(f"  │ Mapping:       {results['mapping_ms']['mean']:.1f} ± {results['mapping_ms']['std']:.1f} ms")
        print(f"  │ End-to-end:    {results['e2e_ms']['mean']:.1f} ± {results['e2e_ms']['std']:.1f} ms")
        print(f"  │ FPS:           {results['fps']:.1f}")
        print(f"  │ Points/frame:  {results['points_per_frame']['mean']:,}")
        print(f"  │ Cells/frame:   {results['cells_per_frame']['mean']:,}")
        print(f"  │ Compression:   {results['compression_ratio']:.1f}× reduction")
        print(f"  │ Memory saving: {results['memory']['memory_reduction_pct']:.1f}%")
        print(f"  │ Binary frame:  {results['memory']['binary_frame_bytes']}")
        print(f"  │ GPU VRAM:      {results['memory']['gpu_vram_mb']:.1f} MB")
        print(f"  └───────────────────────────────────────────────────")
        print()

    # ── Save results ─────────────────────────────────────────────────────
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(all_benchmarks, f, indent=2)
        print(f"Benchmarks saved to: {output_path}")

    print("Benchmark complete.")


if __name__ == "__main__":
    main()
