#!/usr/bin/env python3
"""
Cylinder3D Colab/Kaggle Inference Script
==========================================
Run this on a CUDA GPU machine (Colab T4, Kaggle P100, etc.)
to generate Cylinder3D predictions for your SemanticKITTI data.

SETUP (run in Colab cells before this script):
    !pip install spconv-cu118 numba strictyaml torch-scatter
    !git clone https://github.com/xinge008/Cylinder3D.git /content/Cylinder3D
    # Download pre-trained weights:
    # Place model_save_backup.pt in /content/Cylinder3D/

USAGE:
    python scripts/cylinder3d_colab_inference.py \\
        --cylinder3d_root /content/Cylinder3D \\
        --data_root /content/semantic-kitti \\
        --checkpoint /content/Cylinder3D/model_save_backup.pt \\
        --sequences 00 08 \\
        --output /content/predictions/cylinder3d

Then download the predictions/ folder to your Mac project.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import numpy as np
import torch


def parse_args():
    p = argparse.ArgumentParser(description="Cylinder3D batch inference")
    p.add_argument("--cylinder3d_root", type=str, default="/content/Cylinder3D",
                    help="Path to cloned Cylinder3D repo")
    p.add_argument("--data_root", type=str, required=True,
                    help="SemanticKITTI root (containing sequences/)")
    p.add_argument("--checkpoint", type=str, required=True,
                    help="Path to Cylinder3D pre-trained weights")
    p.add_argument("--sequences", type=str, nargs="+", default=["08"],
                    help="Sequences to process")
    p.add_argument("--output", type=str, default="predictions/cylinder3d",
                    help="Output directory for .npz files")
    p.add_argument("--device", type=str, default="cuda")
    p.add_argument("--max_frames", type=int, default=0,
                    help="Max frames per sequence (0=all)")
    return p.parse_args()


def load_cylinder3d_model(cylinder3d_root, checkpoint_path, device):
    """Load the Cylinder3D model from the official repo."""
    # Add Cylinder3D to path
    sys.path.insert(0, cylinder3d_root)

    # The official Cylinder3D uses these modules
    from network.cylinder_spconv_3d import get_model_class
    from network.segmentator_3d_asymm_spconv import Asymm_3d_spconv
    from dataloader.dataset_semantickitti import (
        cylinder_dataset_val,
        collate_fn_BEV_val,
    )
    import yaml

    # Load config
    config_path = os.path.join(cylinder3d_root, "config", "semantickitti.yaml")
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    # Build model
    model_config = config["model_params"]
    model = get_model_class(model_config)
    model = model.to(device)

    # Load checkpoint
    ckpt = torch.load(checkpoint_path, map_location=device)
    if "model_state_dict" in ckpt:
        model.load_state_dict(ckpt["model_state_dict"])
    elif "state_dict" in ckpt:
        model.load_state_dict(ckpt["state_dict"])
    else:
        model.load_state_dict(ckpt)

    model.eval()
    print(f"Cylinder3D loaded from {checkpoint_path}")
    return model, config


def cylindrical_projection(xyz, grid_size=[480, 360, 32], fov_up=3.0, fov_down=-25.0):
    """Convert Cartesian xyz to cylindrical grid indices."""
    rho = np.sqrt(xyz[:, 0] ** 2 + xyz[:, 1] ** 2)
    theta = np.arctan2(xyz[:, 1], xyz[:, 0])
    z = xyz[:, 2]

    # Normalize to grid
    rho_max = 50.0  # max range
    rho_norm = np.clip(rho / rho_max, 0, 1)
    theta_norm = (theta + np.pi) / (2 * np.pi)
    z_min, z_max = -3.0, 1.0
    z_norm = np.clip((z - z_min) / (z_max - z_min), 0, 1)

    # Grid indices
    rho_idx = np.clip((rho_norm * grid_size[0]).astype(int), 0, grid_size[0] - 1)
    theta_idx = np.clip((theta_norm * grid_size[1]).astype(int), 0, grid_size[1] - 1)
    z_idx = np.clip((z_norm * grid_size[2]).astype(int), 0, grid_size[2] - 1)

    return rho_idx, theta_idx, z_idx


def run_inference_simple(model, xyz, intensity, device, grid_size=[480, 360, 32]):
    """Run Cylinder3D inference using the official repo's pipeline.

    This is a simplified version. For best results, use the official
    dataloader from the Cylinder3D repo.
    """
    N = len(xyz)

    # Build point features: [x, y, z, intensity, rho, theta, z_norm, ...]
    rho = np.sqrt(xyz[:, 0] ** 2 + xyz[:, 1] ** 2)
    theta = np.arctan2(xyz[:, 1], xyz[:, 0])

    # Point features (match Cylinder3D expected input)
    point_features = np.stack([
        xyz[:, 0], xyz[:, 1], xyz[:, 2],
        intensity,
        rho,
        theta,
        xyz[:, 2],  # z again for the network
    ], axis=1).astype(np.float32)

    # Compute cylindrical grid indices
    rho_idx, theta_idx, z_idx = cylindrical_projection(xyz, grid_size)
    grid_indices = np.stack([rho_idx, theta_idx, z_idx], axis=1)

    # Convert to tensors
    pt_fea_t = torch.from_numpy(point_features).unsqueeze(0).to(device)
    grid_idx_t = torch.from_numpy(grid_indices.astype(np.int64)).unsqueeze(0).to(device)

    with torch.no_grad():
        # The exact forward call depends on the Cylinder3D version
        # This may need adjustment based on the model's forward signature
        try:
            output = model(pt_fea_t, grid_idx_t, batch_size=1)
        except Exception:
            # Alternative: some versions expect different input format
            output = model(pt_fea_t, grid_idx_t)

    # Extract per-point predictions
    if isinstance(output, (list, tuple)):
        logits = output[0]
    else:
        logits = output

    probs = torch.softmax(logits, dim=-1)
    pred_ids = probs.argmax(dim=-1).cpu().numpy().flatten()[:N]
    confidences = probs.max(dim=-1).values.cpu().numpy().flatten()[:N]

    return pred_ids.astype(np.int64), confidences.astype(np.float32)


def main():
    args = parse_args()

    print("=" * 60)
    print("  Cylinder3D Inference (Colab/Kaggle)")
    print("=" * 60)
    print(f"  Cylinder3D root: {args.cylinder3d_root}")
    print(f"  Data root:       {args.data_root}")
    print(f"  Checkpoint:      {args.checkpoint}")
    print(f"  Sequences:       {args.sequences}")
    print(f"  Output:          {args.output}")
    print(f"  Device:          {args.device}")
    print()

    # Try to load the model
    device = torch.device(args.device)

    try:
        model, config = load_cylinder3d_model(
            args.cylinder3d_root, args.checkpoint, device
        )
        use_official = True
    except Exception as e:
        print(f"⚠️  Could not load official Cylinder3D model: {e}")
        print("    Falling back to direct inference mode.")
        print("    Make sure the Cylinder3D repo is properly set up.")
        use_official = False
        return

    # Process sequences
    for seq in args.sequences:
        vel_dir = Path(args.data_root) / "sequences" / seq / "velodyne"
        if not vel_dir.exists():
            print(f"⚠️  Sequence {seq} not found at {vel_dir}")
            continue

        out_dir = Path(args.output) / seq
        out_dir.mkdir(parents=True, exist_ok=True)

        bin_files = sorted(vel_dir.glob("*.bin"))
        total = len(bin_files)
        if args.max_frames > 0:
            total = min(total, args.max_frames)

        print(f"\n── Sequence {seq}: {total} frames ──")

        times = []
        for i, bin_path in enumerate(bin_files[:total]):
            fid = int(bin_path.stem)

            # Load scan
            scan = np.fromfile(str(bin_path), dtype=np.float32).reshape(-1, 4)
            xyz = scan[:, :3]
            intensity = np.clip(scan[:, 3], 0, 1)

            # Run inference
            t0 = time.perf_counter()
            pred_ids, confidences = run_inference_simple(
                model, xyz, intensity, device
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000

            # Save
            out_path = out_dir / f"{fid:06d}.npz"
            np.savez_compressed(
                str(out_path),
                semantic_ids=pred_ids.astype(np.int16),
                confidences=confidences.astype(np.float16),
            )

            times.append(elapsed_ms)
            if (i + 1) % 50 == 0 or (i + 1) == total:
                avg = np.mean(times[-50:])
                fps = 1000 / avg if avg > 0 else 0
                print(
                    f"  Frame {i + 1:5d}/{total} | "
                    f"{elapsed_ms:.0f} ms ({fps:.1f} FPS) | "
                    f"{out_path.name}"
                )

        # Summary
        total_mb = sum(
            f.stat().st_size for f in out_dir.glob("*.npz")
        ) / (1024 * 1024)
        print(f"  ✅ Seq {seq}: {len(times)} frames, {total_mb:.1f} MB")

    print(f"\n{'=' * 60}")
    print(f"  Done! Transfer '{args.output}/' to your Mac project.")
    print(f"  The backend will auto-detect predictions at:")
    print(f"    predictions/cylinder3d/")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
