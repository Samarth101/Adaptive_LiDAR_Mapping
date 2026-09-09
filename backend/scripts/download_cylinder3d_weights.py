"""
Download Cylinder3D pretrained weights for SemanticKITTI.

Uses the L-Reichardt/Cylinder3D-updated-CUDA retrained weights
(spconv v2 compatible, 63.2 mIoU on SemanticKITTI val).
"""

import os
import sys
import urllib.request
from pathlib import Path

# The community-maintained weights from L-Reichardt's repo
# These are hosted on Google Drive — we use gdown if available, else direct URL
WEIGHTS_URL = "https://github.com/L-Reichardt/Cylinder3D-updated-CUDA/releases/download/v1.0/model_save.pt"
FALLBACK_MSG = """
=== Cylinder3D Weights Download ===

Automatic download may fail if weights are hosted on Google Drive.

Manual steps:
  1. Go to: https://github.com/L-Reichardt/Cylinder3D-updated-CUDA
  2. Look for the pretrained weights link in the README or Releases
  3. Download the .pt file
  4. Place it in: {target_dir}/cylinder3d_semantickitti.pt

Alternative: Use the PVKD teacher weights from:
  https://github.com/cardwing/Codes-for-PVKD
"""


def download_file(url: str, target_path: str) -> bool:
    """Download a file with progress reporting."""
    print(f"Downloading: {url}")
    print(f"Target: {target_path}")

    try:
        def progress_hook(block_num, block_size, total_size):
            downloaded = block_num * block_size
            if total_size > 0:
                pct = min(100, downloaded * 100 // total_size)
                mb_done = downloaded / (1024 * 1024)
                mb_total = total_size / (1024 * 1024)
                print(f"\r  {pct}% ({mb_done:.1f}/{mb_total:.1f} MB)", end="", flush=True)

        urllib.request.urlretrieve(url, target_path, reporthook=progress_hook)
        print(f"\n✓ Downloaded successfully: {target_path}")
        return True
    except Exception as e:
        print(f"\n[ERROR] Download failed: {e}")
        return False


def main():
    backend_root = Path(__file__).resolve().parent.parent
    target_dir = backend_root / "checkpoints" / "cylinder3d"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / "cylinder3d_semantickitti.pt"

    if target_path.exists():
        size_mb = target_path.stat().st_size / (1024 * 1024)
        print(f"Checkpoint already exists: {target_path} ({size_mb:.1f} MB)")
        return

    # Try direct download
    success = download_file(WEIGHTS_URL, str(target_path))

    if not success:
        # Try with gdown for Google Drive links
        try:
            import gdown
            # Known Google Drive ID for Cylinder3D weights
            gdown.download(
                "https://drive.google.com/uc?id=1tFjBjKGNTVCk_xP4K78N-S73Agl0djKS",
                str(target_path),
                quiet=False,
            )
            success = True
        except ImportError:
            print("gdown not installed. Install with: pip install gdown")
        except Exception as e:
            print(f"gdown download failed: {e}")

    if not success:
        print(FALLBACK_MSG.format(target_dir=target_dir))
        sys.exit(1)


if __name__ == "__main__":
    main()
