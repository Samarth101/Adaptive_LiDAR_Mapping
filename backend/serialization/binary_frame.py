import struct
import json
import base64
import numpy as np
from dataclasses import dataclass, field
from typing import Optional, Dict, Any

MAGIC = 0x4C494441
VERSION = 1

FLAG_RAW_POINTS = 1
FLAG_ELEVATION = 2
FLAG_DISTANCE_METRICS = 4

@dataclass
class FrameData:
    frame_id: int
    timestamp: float
    
    # Adaptive Grid Cells
    cell_x: np.ndarray          # Float32Array
    cell_y: np.ndarray          # Float32Array
    cell_resolution: np.ndarray # Float32Array
    cell_semantic_id: np.ndarray# Uint16Array
    cell_confidence: np.ndarray # Float32Array
    cell_object_height: np.ndarray # Float32Array
    cell_ground_elev: np.ndarray# Float32Array
    cell_point_count: np.ndarray# Uint32Array

    # Raw Points (optional)
    raw_x: Optional[np.ndarray] = None          # Float32Array
    raw_y: Optional[np.ndarray] = None          # Float32Array
    raw_z: Optional[np.ndarray] = None          # Float32Array
    raw_semantic_id: Optional[np.ndarray] = None# Uint16Array
    raw_confidence: Optional[np.ndarray] = None # Float32Array

    # Elevation Grid (optional)
    cell_mean_height: Optional[np.ndarray] = None # Float32Array
    cell_height_var: Optional[np.ndarray] = None  # Float32Array

    # Distance Metrics (optional)
    band_miou: Optional[np.ndarray] = None        # Float32Array
    band_accuracy: Optional[np.ndarray] = None    # Float32Array
    band_point_count: Optional[np.ndarray] = None # Uint32Array
    band_mean_conf: Optional[np.ndarray] = None   # Float32Array


def serialize_binary(frame: FrameData) -> bytes:
    flags = 0
    if frame.raw_x is not None:
        flags |= FLAG_RAW_POINTS
    if frame.cell_mean_height is not None:
        flags |= FLAG_ELEVATION
    if frame.band_miou is not None:
        flags |= FLAG_DISTANCE_METRICS

    cell_count = len(frame.cell_x)
    point_count = len(frame.raw_x) if frame.raw_x is not None else 0
    
    # Ensure types
    cell_x = frame.cell_x.astype(np.float32)
    cell_y = frame.cell_y.astype(np.float32)
    cell_resolution = frame.cell_resolution.astype(np.float32)
    cell_semantic_id = frame.cell_semantic_id.astype(np.uint16)
    cell_confidence = frame.cell_confidence.astype(np.float32)
    cell_object_height = frame.cell_object_height.astype(np.float32)
    cell_ground_elev = frame.cell_ground_elev.astype(np.float32)
    cell_point_count = frame.cell_point_count.astype(np.uint32)

    # 32-byte header
    # magic:       uint32    (0x4C494441 = "LIDA")
    # version:     uint16    (1)
    # flags:       uint16    
    # frame_id:    uint32
    # timestamp:   float64
    # cell_count:  uint32
    # point_count: uint32    
    # reserved:    uint32
    
    header = struct.pack(
        "<I H H I d I I I",
        MAGIC,
        VERSION,
        flags,
        frame.frame_id,
        frame.timestamp,
        cell_count,
        point_count,
        0 # reserved
    )
    
    # Padding for cell_semantic_id (uint16)
    cell_sem_bytes = cell_semantic_id.tobytes()
    if len(cell_sem_bytes) % 4 != 0:
        cell_sem_bytes += b'\x00' * (4 - (len(cell_sem_bytes) % 4))
        
    payloads = [
        cell_x.tobytes(),
        cell_y.tobytes(),
        cell_resolution.tobytes(),
        cell_sem_bytes,
        cell_confidence.tobytes(),
        cell_object_height.tobytes(),
        cell_ground_elev.tobytes(),
        cell_point_count.tobytes()
    ]

    if flags & FLAG_RAW_POINTS:
        raw_x = frame.raw_x.astype(np.float32)
        raw_y = frame.raw_y.astype(np.float32)
        raw_z = frame.raw_z.astype(np.float32)
        raw_semantic_id = frame.raw_semantic_id.astype(np.uint16)
        raw_confidence = frame.raw_confidence.astype(np.float32)

        raw_sem_bytes = raw_semantic_id.tobytes()
        if len(raw_sem_bytes) % 4 != 0:
            raw_sem_bytes += b'\x00' * (4 - (len(raw_sem_bytes) % 4))

        payloads.extend([
            raw_x.tobytes(),
            raw_y.tobytes(),
            raw_z.tobytes(),
            raw_sem_bytes,
            raw_confidence.tobytes()
        ])

    if flags & FLAG_ELEVATION:
        cell_mean_height = frame.cell_mean_height.astype(np.float32)
        cell_height_var = frame.cell_height_var.astype(np.float32)
        payloads.extend([
            cell_mean_height.tobytes(),
            cell_height_var.tobytes()
        ])

    if flags & FLAG_DISTANCE_METRICS:
        band_count = len(frame.band_miou)
        band_count_bytes = struct.pack("<B", band_count)
        # Pad to 4 bytes
        band_count_bytes += b'\x00' * 3
        
        band_miou = frame.band_miou.astype(np.float32)
        band_accuracy = frame.band_accuracy.astype(np.float32)
        band_point_count = frame.band_point_count.astype(np.uint32)
        band_mean_conf = frame.band_mean_conf.astype(np.float32)
        
        payloads.extend([
            band_count_bytes,
            band_miou.tobytes(),
            band_accuracy.tobytes(),
            band_point_count.tobytes(),
            band_mean_conf.tobytes()
        ])

    return header + b''.join(payloads)


def deserialize_binary(data: bytes) -> FrameData:
    magic, version, flags, frame_id, timestamp, cell_count, point_count, _ = struct.unpack_from("<I H H I d I I I", data, 0)
    
    if magic != MAGIC:
        raise ValueError(f"Invalid magic number: {magic}")
    
    offset = 32
    
    def read_array(dtype, count):
        nonlocal offset
        arr = np.frombuffer(data, dtype=dtype, count=count, offset=offset).copy()
        offset += arr.nbytes
        if arr.nbytes % 4 != 0:
            offset += 4 - (arr.nbytes % 4)
        return arr

    cell_x = read_array(np.float32, cell_count)
    cell_y = read_array(np.float32, cell_count)
    cell_resolution = read_array(np.float32, cell_count)
    cell_semantic_id = read_array(np.uint16, cell_count)
    cell_confidence = read_array(np.float32, cell_count)
    cell_object_height = read_array(np.float32, cell_count)
    cell_ground_elev = read_array(np.float32, cell_count)
    cell_point_count = read_array(np.uint32, cell_count)

    frame = FrameData(
        frame_id=frame_id,
        timestamp=timestamp,
        cell_x=cell_x,
        cell_y=cell_y,
        cell_resolution=cell_resolution,
        cell_semantic_id=cell_semantic_id,
        cell_confidence=cell_confidence,
        cell_object_height=cell_object_height,
        cell_ground_elev=cell_ground_elev,
        cell_point_count=cell_point_count
    )

    if flags & FLAG_RAW_POINTS:
        frame.raw_x = read_array(np.float32, point_count)
        frame.raw_y = read_array(np.float32, point_count)
        frame.raw_z = read_array(np.float32, point_count)
        frame.raw_semantic_id = read_array(np.uint16, point_count)
        frame.raw_confidence = read_array(np.float32, point_count)

    if flags & FLAG_ELEVATION:
        frame.cell_mean_height = read_array(np.float32, cell_count)
        frame.cell_height_var = read_array(np.float32, cell_count)

    if flags & FLAG_DISTANCE_METRICS:
        band_count = struct.unpack_from("<B", data, offset)[0]
        offset += 4 # 1 byte + 3 bytes padding
        frame.band_miou = read_array(np.float32, band_count)
        frame.band_accuracy = read_array(np.float32, band_count)
        frame.band_point_count = read_array(np.uint32, band_count)
        frame.band_mean_conf = read_array(np.float32, band_count)

    return frame


def serialize_json(frame: FrameData) -> str:
    res = {
        "frame_id": frame.frame_id,
        "timestamp": frame.timestamp,
        "cell_x": frame.cell_x.tolist(),
        "cell_y": frame.cell_y.tolist(),
        "cell_resolution": frame.cell_resolution.tolist(),
        "cell_semantic_id": frame.cell_semantic_id.tolist(),
        "cell_confidence": frame.cell_confidence.tolist(),
        "cell_object_height": frame.cell_object_height.tolist(),
        "cell_ground_elev": frame.cell_ground_elev.tolist(),
        "cell_point_count": frame.cell_point_count.tolist()
    }
    
    if frame.raw_x is not None:
        res["raw_x"] = frame.raw_x.tolist()
        res["raw_y"] = frame.raw_y.tolist()
        res["raw_z"] = frame.raw_z.tolist()
        res["raw_semantic_id"] = frame.raw_semantic_id.tolist()
        res["raw_confidence"] = frame.raw_confidence.tolist()
        
    if frame.cell_mean_height is not None:
        res["cell_mean_height"] = frame.cell_mean_height.tolist()
        res["cell_height_var"] = frame.cell_height_var.tolist()
        
    if frame.band_miou is not None:
        res["band_miou"] = frame.band_miou.tolist()
        res["band_accuracy"] = frame.band_accuracy.tolist()
        res["band_point_count"] = frame.band_point_count.tolist()
        res["band_mean_conf"] = frame.band_mean_conf.tolist()

    return json.dumps(res)
