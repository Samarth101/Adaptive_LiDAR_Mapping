"""
FastAPI + WebSocket Backend Server
====================================
Entry point for the SIH26053 ML backend.  Serves all four frontend elements
via REST endpoints and WebSocket binary frame streaming.

Usage::

    uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload
    # or
    python -m backend.server
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

# Ensure repository root is in sys.path so 'import backend.xyz' always resolves
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import BackendConfig
from backend.core.data_loader import (
    list_sequences,
    list_frames,
    frame_paths,
    load_frame,
    SequenceIterator,
)
from backend.core.frame_processor import FrameProcessor, FrameResult
from backend.models import create_model, get_available_models, MODEL_REGISTRY
from backend.models.base import BaseSegmentationModel
from backend.serialization.binary_frame import serialize_binary, serialize_json, FrameData
from backend.utils.class_mapping import CLASS_NAMES, CLASS_COLORS, NUM_CLASSES

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────
# App Configuration
# ─────────────────────────────────────────────────────────────────────────

cfg = BackendConfig()
app = FastAPI(
    title="SIH26053 — Adaptive LiDAR Mapping Backend",
    description=(
        "ML backend for Adaptive Variable Resolution 2.5D LiDAR Mapping. "
        "Serves semantic segmentation, foveated grid, elevation, and "
        "per-distance accuracy to the frontend."
    ),
    version="1.0.0",
)

# CORS for local frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=cfg.cors_origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────
# Global state
# ─────────────────────────────────────────────────────────────────────────

processor = FrameProcessor(config=cfg)
loaded_models: Dict[str, BaseSegmentationModel] = {}


def _ensure_model(name: str) -> BaseSegmentationModel:
    """Load and cache a model by name."""
    if name in loaded_models:
        return loaded_models[name]

    model = create_model(name, device=cfg.device)

    # Try to find checkpoint
    ckpt_dir = Path(cfg.checkpoint_dir) / name
    ckpt_files = sorted(ckpt_dir.glob("*.pth")) + sorted(ckpt_dir.glob("*.pt"))

    if ckpt_files:
        model.load_checkpoint(str(ckpt_files[-1]))
        logger.info(f"Loaded {name} checkpoint: {ckpt_files[-1]}")
    else:
        logger.warning(
            f"No checkpoint found for {name} in {ckpt_dir}. "
            f"Model will produce random predictions."
        )

    loaded_models[name] = model
    return model


# ─────────────────────────────────────────────────────────────────────────
# REST Endpoints
# ─────────────────────────────────────────────────────────────────────────

@app.get("/api/status")
async def status():
    """Server health and state."""
    return {
        "status": "ok",
        "active_model": processor.get_model_name() or None,
        "available_models": get_available_models(),
        "loaded_models": list(loaded_models.keys()),
        "device": cfg.resolve_device(),
        "num_classes": NUM_CLASSES,
        "resolution_bands": [
            {
                "min_m": b.min_distance,
                "max_m": b.max_distance,
                "cell_size_m": b.cell_size,
            }
            for b in cfg.resolution_bands
        ],
    }


@app.get("/api/models")
async def list_models():
    """List available models and their status."""
    result = []
    for name in get_available_models():
        model_info = {
            "name": name,
            "loaded": name in loaded_models,
            "active": name == processor.get_model_name(),
            "has_checkpoint": bool(
                list((Path(cfg.checkpoint_dir) / name).glob("*.pth"))
                + list((Path(cfg.checkpoint_dir) / name).glob("*.pt"))
            ),
        }
        if name in loaded_models:
            m = loaded_models[name]
            model_info["device"] = m.get_device()
            model_info["num_classes"] = m.get_num_classes()
        result.append(model_info)
    return result


@app.post("/api/model/select")
async def select_model(name: str = Query(..., description="Model name")):
    """Switch the active segmentation model."""
    available = get_available_models()
    if name not in available:
        return JSONResponse(
            status_code=400,
            content={"error": f"Unknown model '{name}'. Available: {available}"},
        )
    model = _ensure_model(name)
    processor.set_model(model)
    return {
        "status": "ok",
        "active_model": name,
        "device": model.get_device(),
        "is_loaded": model.is_loaded(),
    }


@app.get("/api/classes")
async def get_classes():
    """Class names, colors, and category mappings."""
    classes = []
    for cid in range(NUM_CLASSES):
        r, g, b = CLASS_COLORS.get(cid, (128, 128, 128))
        classes.append({
            "id": cid,
            "name": CLASS_NAMES.get(cid, f"class-{cid}"),
            "color": {"r": r, "g": g, "b": b},
            "hex": f"#{r:02x}{g:02x}{b:02x}",
        })
    return classes


@app.get("/api/sequences")
async def get_sequences():
    """List available SemanticKITTI sequences and frame counts."""
    seqs = list_sequences(cfg.velodyne_root)
    result = []
    for seq in seqs:
        frames = list_frames(cfg.velodyne_root, seq)
        has_labels = (Path(cfg.label_root) / seq / "labels").exists()
        result.append({
            "id": seq,
            "frame_count": len(frames),
            "has_labels": has_labels,
            "is_train": seq in cfg.train_sequences,
            "is_val": seq in cfg.val_sequences,
            "is_test": seq in cfg.test_sequences,
        })
    return result


@app.get("/api/frame/{sequence}/{frame_id}")
async def get_frame(
    sequence: str,
    frame_id: int,
    model: str = Query("pointnet2", description="Model name"),
    fmt: str = Query("json", description="Response format: json or binary"),
):
    """Process and return a single frame (REST, for debugging)."""
    # Ensure model
    m = _ensure_model(model)
    processor.set_model(m)

    # Resolve paths
    scan, label = frame_paths(
        cfg.velodyne_root, cfg.label_root, sequence, frame_id
    )
    if not scan.exists():
        return JSONResponse(
            status_code=404,
            content={"error": f"Scan not found: {scan}"},
        )

    # Process
    result = processor.process_frame(
        str(scan),
        str(label) if label else None,
        frame_id=frame_id,
        sequence=sequence,
    )

    frame_data = processor.result_to_frame_data(result)

    if fmt == "binary":
        binary = serialize_binary(frame_data)
        from fastapi.responses import Response

        return Response(content=binary, media_type="application/octet-stream")

    # JSON response with summary
    return {
        "frame_id": result.frame_id,
        "sequence": result.sequence,
        "model": result.model_name,
        "num_points": result.num_points,
        "num_cells": result.num_cells,
        "compression_ratio": round(result.compression_ratio, 1),
        "timing": {
            "load_ms": round(result.load_ms, 1),
            "inference_ms": round(result.inference_ms, 1),
            "grid_ms": round(result.grid_ms, 1),
            "elevation_ms": round(result.elevation_ms, 1),
            "evaluation_ms": round(result.evaluation_ms, 1),
            "total_ms": round(result.total_ms, 1),
            "fps": round(result.fps, 1),
        },
        "evaluation": (
            {
                "overall_miou": round(result.evaluation.overall_miou, 4),
                "overall_accuracy": round(result.evaluation.overall_accuracy, 4),
                "per_band": [
                    {
                        "range": f"{b.min_distance:.0f}-{b.max_distance:.0f}m",
                        "miou": round(b.miou, 4) if not np.isnan(b.miou) else None,
                        "accuracy": round(b.accuracy, 4)
                        if not np.isnan(b.accuracy)
                        else None,
                        "mean_confidence": round(b.mean_confidence, 4),
                        "point_count": b.point_count,
                    }
                    for b in result.evaluation.per_band
                ],
            }
            if result.evaluation
            else None
        ),
        "frame_data_json": serialize_json(frame_data),
    }


# ─────────────────────────────────────────────────────────────────────────
# WebSocket Streaming
# ─────────────────────────────────────────────────────────────────────────

@app.websocket("/ws/stream")
async def ws_stream(websocket: WebSocket):
    """Stream binary frames to the frontend.

    The client sends JSON control messages::

        {"action": "start", "sequence": "00", "model": "pointnet2", "fps": 10}
        {"action": "pause"}
        {"action": "resume"}
        {"action": "seek", "frame": 100}
        {"action": "stop"}
        {"action": "set_model", "model": "cylinder3d"}

    The server sends Binary Frame V1 packets.
    """
    await websocket.accept()
    logger.info("WebSocket client connected.")

    streaming = False
    paused = False
    current_seq = "00"
    current_model = cfg.default_model
    target_fps = cfg.target_fps
    current_frame_idx = 0
    frame_list: List[int] = []

    try:
        while True:
            # Check for control messages (non-blocking)
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_text(), timeout=0.01
                )
                msg = json.loads(raw)
                action = msg.get("action", "")

                if action == "start":
                    current_seq = msg.get("sequence", current_seq)
                    current_model = msg.get("model", current_model)
                    target_fps = msg.get("fps", target_fps)
                    current_frame_idx = msg.get("frame", 0)

                    # Load model
                    m = _ensure_model(current_model)
                    processor.set_model(m)

                    # List frames
                    frame_list = list_frames(cfg.velodyne_root, current_seq)
                    if current_frame_idx >= len(frame_list):
                        current_frame_idx = 0

                    streaming = True
                    paused = False
                    logger.info(
                        f"Streaming: seq={current_seq}, model={current_model}, "
                        f"fps={target_fps}, frames={len(frame_list)}"
                    )
                    await websocket.send_json({
                        "type": "info",
                        "message": "streaming_started",
                        "sequence": current_seq,
                        "model": current_model,
                        "total_frames": len(frame_list),
                    })

                elif action == "pause":
                    paused = True

                elif action == "resume":
                    paused = False

                elif action == "seek":
                    current_frame_idx = msg.get("frame", 0)
                    if current_frame_idx >= len(frame_list):
                        current_frame_idx = 0

                elif action == "stop":
                    streaming = False
                    await websocket.send_json({
                        "type": "info",
                        "message": "streaming_stopped",
                    })

                elif action == "set_model":
                    new_model = msg.get("model", current_model)
                    m = _ensure_model(new_model)
                    processor.set_model(m)
                    current_model = new_model
                    await websocket.send_json({
                        "type": "info",
                        "message": "model_changed",
                        "model": current_model,
                    })

            except asyncio.TimeoutError:
                pass  # No message — continue streaming

            # Stream frames
            if streaming and not paused and frame_list:
                t_start = time.perf_counter()

                fid = frame_list[current_frame_idx]
                scan, label = frame_paths(
                    cfg.velodyne_root, cfg.label_root, current_seq, fid
                )

                # Process frame
                result = processor.process_frame(
                    str(scan),
                    str(label) if label else None,
                    frame_id=fid,
                    sequence=current_seq,
                )
                frame_data = processor.result_to_frame_data(result)
                binary = serialize_binary(frame_data)

                # Send binary frame
                await websocket.send_bytes(binary)

                # Advance frame
                current_frame_idx = (current_frame_idx + 1) % len(frame_list)

                # Rate limiting
                elapsed = time.perf_counter() - t_start
                target_dt = 1.0 / target_fps
                sleep_time = target_dt - elapsed
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
            else:
                await asyncio.sleep(0.05)  # Idle sleep

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    except Exception as exc:
        logger.error(f"WebSocket error: {exc}", exc_info=True)
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass


@app.websocket("/ws/single")
async def ws_single(websocket: WebSocket):
    """Single-frame prediction via WebSocket (for debugging).

    Client sends::

        {"sequence": "00", "frame": 0, "model": "pointnet2"}

    Server sends JSON response with full data.
    """
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            seq = msg.get("sequence", "00")
            fid = msg.get("frame", 0)
            model_name = msg.get("model", cfg.default_model)

            m = _ensure_model(model_name)
            processor.set_model(m)

            scan, label = frame_paths(
                cfg.velodyne_root, cfg.label_root, seq, fid
            )
            if not scan.exists():
                await websocket.send_json({
                    "type": "error",
                    "message": f"Scan not found: {scan}",
                })
                continue

            result = processor.process_frame(
                str(scan),
                str(label) if label else None,
                frame_id=fid,
                sequence=seq,
            )
            frame_data = processor.result_to_frame_data(result)

            await websocket.send_json({
                "type": "frame",
                "frame_id": result.frame_id,
                "model": result.model_name,
                "num_points": result.num_points,
                "num_cells": result.num_cells,
                "timing_ms": round(result.total_ms, 1),
                "fps": round(result.fps, 1),
                "data": serialize_json(frame_data),
            })

    except WebSocketDisconnect:
        logger.info("Single-frame WS client disconnected.")


# ─────────────────────────────────────────────────────────────────────────
# Startup / main
# ─────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    """Pre-load the default model on server start."""
    logger.info("SIH26053 Backend starting...")
    logger.info(f"Velodyne root: {cfg.velodyne_root}")
    logger.info(f"Label root:    {cfg.label_root}")
    logger.info(f"Device:        {cfg.resolve_device()}")
    logger.info(f"Available models: {get_available_models()}")

    # Try to load default model
    try:
        m = _ensure_model(cfg.default_model)
        processor.set_model(m)
        logger.info(f"Default model '{cfg.default_model}' loaded.")
    except Exception as exc:
        logger.warning(
            f"Could not load default model '{cfg.default_model}': {exc}. "
            f"Try loading a model via POST /api/model/select."
        )
        # Fallback to pointnet2
        if cfg.default_model != "pointnet2":
            try:
                m = _ensure_model("pointnet2")
                processor.set_model(m)
                logger.info("Fallback: PointNet++ loaded.")
            except Exception:
                logger.warning("No model available at startup.")


# ── Run with python -m backend.server ────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    uvicorn.run(
        "backend.server:app",
        host=cfg.host,
        port=cfg.port,
        reload=True,
        log_level="info",
    )
