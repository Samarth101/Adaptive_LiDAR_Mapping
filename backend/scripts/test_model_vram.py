import torch
import time
import gc
import os
import sys

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.models import create_model


def print_vram_usage(msg=""):
    """Prints current CUDA VRAM usage."""
    if torch.cuda.is_available():
        allocated = torch.cuda.memory_allocated() / (1024 ** 2)
        reserved = torch.cuda.memory_reserved() / (1024 ** 2)
        print(f"[{msg}] VRAM Allocated: {allocated:.1f} MB, Reserved: {reserved:.1f} MB")
    else:
        print(f"[{msg}] CUDA not available.")


def test_model(model_name, checkpoint_path=None):
    print(f"\n--- Testing {model_name} ---")
    
    # 1. Clear VRAM
    gc.collect()
    torch.cuda.empty_cache()
    print_vram_usage("Before loading")

    # 2. Initialize Model
    print("Initializing model...")
    t0 = time.time()
    try:
        model = create_model(model_name)
    except Exception as e:
        print(f"Failed to initialize {model_name}: {e}")
        return
    print(f"Initialization took {time.time() - t0:.2f}s")
    print_vram_usage("After initialization")

    # 3. Load Checkpoint
    if checkpoint_path and os.path.exists(checkpoint_path):
        print(f"Loading checkpoint: {checkpoint_path}")
        try:
            model.load_checkpoint(checkpoint_path)
            print_vram_usage("After loading checkpoint")
        except Exception as e:
            print(f"Failed to load checkpoint: {e}")
    else:
        print("No checkpoint loaded (or not found). Testing with random/initial weights.")

    # 4. Warmup
    print("Warming up with dummy data...")
    t1 = time.time()
    try:
        model.warmup()
        print(f"Warmup took {time.time() - t1:.2f}s")
    except Exception as e:
        print(f"Warmup failed: {e}")
    print_vram_usage("After warmup")

    # 5. Clean up
    del model
    gc.collect()
    torch.cuda.empty_cache()
    print_vram_usage("After cleanup")


def main():
    print("CUDA is available:", torch.cuda.is_available())
    if torch.cuda.is_available():
        print("Device:", torch.cuda.get_device_name(0))

    backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    models_to_test = [
        ("pointnet2", os.path.join(backend_root, "checkpoints", "pointnet2", "pointnet2_semantickitti_ep29.pth")),
        ("cylinder3d", os.path.join(backend_root, "checkpoints", "cylinder3d", "cylinder3d_semantickitti.pt")),
        # ("minkunet", os.path.join(backend_root, "checkpoints", "minkunet", "minkunet_w32_8xb2-15e_semantickitti_20230309_160710-7fa0a6f1.pth")),
    ]

    for name, ckpt in models_to_test:
        test_model(name, ckpt)


if __name__ == "__main__":
    main()
