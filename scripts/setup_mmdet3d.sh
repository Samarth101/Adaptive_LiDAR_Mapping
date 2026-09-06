#!/usr/bin/env bash
# ===========================================================================
# MMDetection3D + MinkUNet Installation Script
# ===========================================================================
# Installs the OpenMMLab stack required for MinkUNet semantic segmentation.
# This is OPTIONAL — the backend works with PointNet++ and Cylinder3D alone.
#
# Usage:  bash scripts/setup_mmdet3d.sh
# ===========================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo " MMDetection3D + MinkUNet Setup"
echo "============================================"
echo "Project root: $PROJECT_ROOT"
echo ""

# ── 1. Check Python and PyTorch ──────────────────────────────────────────
echo "[1/6] Checking Python and PyTorch..."
python3 -c "import torch; print(f'PyTorch {torch.__version__}')"
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"

TORCH_VERSION=$(python3 -c "import torch; print(torch.__version__.split('+')[0])")
CUDA_VERSION=$(python3 -c "
import torch
if torch.cuda.is_available():
    v = torch.version.cuda
    print(v.replace('.', ''))
else:
    print('cpu')
")

echo "  PyTorch: $TORCH_VERSION"
echo "  CUDA:    $CUDA_VERSION"
echo ""

# ── 2. Install mmengine ──────────────────────────────────────────────────
echo "[2/6] Installing mmengine..."
pip install --quiet mmengine
python3 -c "import mmengine; print(f'mmengine {mmengine.__version__}')"
echo ""

# ── 3. Install mmcv ──────────────────────────────────────────────────────
echo "[3/6] Installing mmcv..."
if [ "$CUDA_VERSION" = "cpu" ]; then
    pip install --quiet mmcv -f https://download.openmmlab.com/mmcv/dist/cpu/torch${TORCH_VERSION}/index.html
else
    pip install --quiet mmcv -f https://download.openmmlab.com/mmcv/dist/cu${CUDA_VERSION}/torch${TORCH_VERSION}/index.html
fi
python3 -c "import mmcv; print(f'mmcv {mmcv.__version__}')"
echo ""

# ── 4. Install mmdet ─────────────────────────────────────────────────────
echo "[4/6] Installing mmdet..."
pip install --quiet mmdet
python3 -c "import mmdet; print(f'mmdet {mmdet.__version__}')"
echo ""

# ── 5. Install mmdet3d ───────────────────────────────────────────────────
echo "[5/6] Installing mmdet3d..."
pip install --quiet mmdet3d
python3 -c "import mmdet3d; print(f'mmdet3d {mmdet3d.__version__}')"
echo ""

# ── 6. Install MinkowskiEngine ───────────────────────────────────────────
echo "[6/6] Installing MinkowskiEngine..."
echo "  NOTE: MinkowskiEngine requires CUDA toolkit headers."
echo "        If this fails, see: https://github.com/NVIDIA/MinkowskiEngine#installation"

if [ "$CUDA_VERSION" = "cpu" ]; then
    echo "  WARNING: MinkowskiEngine requires CUDA. Skipping on CPU."
else
    pip install --quiet MinkowskiEngine --no-deps \
        || echo "  WARNING: MinkowskiEngine pip install failed. Try building from source."
fi

echo ""

# ── Download MinkUNet checkpoint ─────────────────────────────────────────
CKPT_DIR="$PROJECT_ROOT/checkpoints/minkuNet"
mkdir -p "$CKPT_DIR"

echo "Checkpoint directory: $CKPT_DIR"
echo "Download MinkUNet pre-trained weights from the MMDet3D model zoo:"
echo "  https://github.com/open-mmlab/mmdetection3d/tree/main/configs/minkunet"
echo ""

# ── Smoke test ───────────────────────────────────────────────────────────
echo "Running smoke test..."
python3 -c "
import mmengine
import mmcv
import mmdet
import mmdet3d
print('All OpenMMLab packages imported successfully!')
print(f'  mmengine: {mmengine.__version__}')
print(f'  mmcv:     {mmcv.__version__}')
print(f'  mmdet:    {mmdet.__version__}')
print(f'  mmdet3d:  {mmdet3d.__version__}')
try:
    import MinkowskiEngine as ME
    print(f'  MinkowskiEngine: {ME.__version__}')
except ImportError:
    print('  MinkowskiEngine: NOT AVAILABLE')
"

echo ""
echo "============================================"
echo " MMDetection3D setup complete!"
echo "============================================"
