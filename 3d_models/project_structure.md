# SIH26053 — Project Structure Guide

```
SIH-Adaptive_LiDAR_Mapping/
│
├── backend/                    ← 🧠 ML BACKEND (FastAPI server + pipeline)
│   ├── server.py               ← Entry point: FastAPI + WebSocket server
│   ├── config.py               ← All paths, resolution bands, model & server settings
│   │
│   ├── models/                 ← Segmentation model wrappers (hot-swappable)
│   │   ├── base.py             ← Abstract interface every model implements
│   │   ├── pointnet2_wrapper.py← PointNet++ (20-class, works on CPU/MPS) ✅
│   │   ├── cylinder3d_wrapper.py← Cylinder3D (needs CUDA/spconv) ⚠️ stub on Mac
│   │   ├── minkuNet_wrapper.py ← MinkUNet via MMDet3D (needs CUDA) ⚠️ stub on Mac
│   │   └── precomputed_wrapper.py ← Loads saved .npz predictions (for Cylinder3D on Mac)
│   │
│   ├── core/                   ← Pipeline components
│   │   ├── frame_processor.py  ← Main pipeline: load → infer → grid → elevation → metrics
│   │   ├── adaptive_grid.py    ← Vectorized foveated grid builder + confidence voting
│   │   ├── elevation.py        ← RANSAC ground plane + height gradient for elevation map
│   │   ├── distance_evaluator.py ← Per-distance-band mIoU/accuracy metrics
│   │   └── data_loader.py      ← SemanticKITTI .bin/.label loader + sequence iterator
│   │
│   ├── serialization/
│   │   └── binary_frame.py     ← Binary Frame V1 protocol (WebSocket transport)
│   │
│   └── utils/
│       └── class_mapping.py    ← 20-class names, colors, learning_map, categories
│
├── scripts/                    ← 🔧 CLI TOOLS
│   ├── evaluate_models.py      ← Run mIoU evaluation on validation seq 08
│   ├── benchmark.py            ← Measure FPS, latency, memory, compression ratio
│   ├── export_predictions.py   ← Save per-frame .npz predictions (any model)
│   ├── cylinder3d_colab_inference.py ← Run Cylinder3D on Colab/Kaggle GPU
│   ├── setup_cylinder3d.sh     ← Install Cylinder3D + spconv (CUDA only)
│   └── setup_mmdet3d.sh        ← Install MMDetection3D (CUDA only)
│
├── checkpoints/                ← 🏋️ TRAINED WEIGHTS
│   ├── pointnet2/
│   │   └── pointnet2_semantickitti_ep29.pth  ← Your 30-epoch PointNet++ checkpoint
│   ├── cylinder3d/             ← (place Cylinder3D weights here)
│   └── minkuNet/               ← (place MinkUNet weights here)
│
├── predictions/                ← 📦 PRE-COMPUTED PREDICTIONS (auto-detected by backend)
│   (future: predictions/cylinder3d/08/*.npz from Colab goes here)
│
├── config/
│   └── semantic-kitti.yaml     ← 📋 Official SemanticKITTI class config (26→20 mapping)
│
├── data/                       ← 📂 SEMANTICKITTI DATASET (22 sequences)
│   ├── dataset/sequences/{00-21}/velodyne/*.bin    ← LiDAR point clouds
│   ├── data_odometry_labels/sequences/{00-21}/     ← Labels + poses
│   │   ├── labels/*.label      ← Semantic labels (train seqs 00-10)
│   │   └── poses.txt           ← Vehicle poses
│   └── dataset_calibaration/sequences/{00-21}/     ← Calibration
│
├── sih_pointnet2/              ← 🔬 POINTNET++ TRAINING CODE
│   └── train.py                ← Training script (20-class model definition inside)
│
├── third_party/                ← 🔗 CLONED REPOS
│   └── Cylinder3D/             ← Official Cylinder3D (cloned by setup script)
│
└── requirements.txt            ← Python dependencies
```

## Quick Reference

| I want to...                              | Go to                                           |
|-------------------------------------------|--------------------------------------------------|
| **Start the server**                      | `python -m backend.server`                       |
| **Change server/model settings**          | `backend/config.py`                              |
| **Add a new model**                       | Subclass `backend/models/base.py`, register in `backend/models/__init__.py` |
| **See class names/colors**                | `backend/utils/class_mapping.py`                 |
| **Understand the pipeline**               | `backend/core/frame_processor.py`                |
| **See how the grid is built**             | `backend/core/adaptive_grid.py`                  |
| **See the binary wire format**            | `backend/serialization/binary_frame.py`          |
| **Evaluate model accuracy**               | `python scripts/evaluate_models.py --models pointnet2 --seq 08` |
| **Benchmark FPS/memory**                  | `python scripts/benchmark.py --models pointnet2` |
| **Run Cylinder3D on Colab**               | `scripts/cylinder3d_colab_inference.py`          |

## Codebase Cleanup Note
*The old `src/` directory (containing the previous mapper prototypes) and redundant PointNet++ inference scripts were fully superseded by the `backend/` package and have been removed to keep the codebase concise and production-ready.*
