# SIH PointNet++ SemanticKITTI prototype

This is a clean, TorchSparse-free PointNet++-style semantic segmentation pipeline.

## Install

```bash
pip install numpy torch
```

## Dataset layout

```text
semantic-kitti/
└── sequences/
    ├── 00/
    │   ├── velodyne/
    │   └── labels/
    ├── 01/
    ...
    └── 10/
```

## Smoke test

Before training, run a single batch through the model:

```python
import torch
from models.pointnet2 import build_model

model = build_model(19)
xyz = torch.randn(1, 2048, 3)
intensity = torch.rand(1, 2048, 1)
y = model(xyz, intensity)
print(y.shape)  # [1, 2048, 19]
```

## Training

```bash
python train.py \
  --root /content/semantic-kitti \
  --epochs 20 \
  --batch-size 4 \
  --points 2048 \
  --out /content/checkpoints/pointnet2_semkitti.pt
```

## Inference

```bash
python infer.py \
  --bin /content/semantic-kitti/sequences/00/velodyne/000000.bin \
  --checkpoint /content/checkpoints/pointnet2_semkitti.pt \
  --out /content/prediction.npz
```

The output contains:

- `points`: original `[x,y,z,intensity]`
- `prediction`: 19-class model IDs
- `confidence`: maximum softmax probability

## Important prototype limitation

This first version intentionally uses fixed-size random blocks and a straightforward PointNet++ implementation. It is for getting the ML pipeline running first. Once training/inference works, we will improve sampling, class balancing, evaluation (mIoU), frame-level inference, and finally connect predictions + confidence to the adaptive 2.5D grid.
