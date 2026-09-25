from .base import BaseSegmentationModel
from .pointnet2_wrapper import PointNet2Wrapper
from .precomputed_wrapper import PrecomputedModelWrapper

# Optional model imports — only available if dependencies are installed
try:
    from .cylinder3d_wrapper import Cylinder3DWrapper
except ImportError:
    Cylinder3DWrapper = None

MODEL_REGISTRY = {
    "pointnet2": PointNet2Wrapper,
}

if Cylinder3DWrapper is not None:
    MODEL_REGISTRY["cylinder3d"] = Cylinder3DWrapper

def get_available_models():
    """Return names of models whose dependencies are installed."""
    names = list(MODEL_REGISTRY.keys())
    from pathlib import Path
    from backend.config import BackendConfig
    cfg = BackendConfig()
    pred_root = Path(cfg.predictions_dir)
    if pred_root.exists():
        for child in pred_root.iterdir():
            if child.is_dir():
                pc_name = f"{child.name}_precomputed"
                if pc_name not in names:
                    names.append(pc_name)
    return names

def create_model(name: str, **kwargs) -> BaseSegmentationModel:
    if name in MODEL_REGISTRY:
        return MODEL_REGISTRY[name](**kwargs)

    if name.endswith("_precomputed"):
        base_name = name.replace("_precomputed", "")
        from pathlib import Path
        from backend.config import BackendConfig
        cfg = BackendConfig()
        pred_dir = Path(cfg.predictions_dir) / base_name
        if pred_dir.exists():
            return PrecomputedModelWrapper(
                predictions_dir=str(pred_dir),
                model_name=name,
                **{k: v for k, v in kwargs.items() if k in ("device", "num_classes")},
            )

    available = ", ".join(get_available_models())
    raise ValueError(f"Unknown model '{name}'. Available: {available}")
