import struct
import json
import base64
import numpy as np
from dataclasses import dataclass, field
from typing import Optional, Dict, Any

MAGIC = 0x4C494441
VERSION = 2

FLAG_RAW_POINTS = 1
FLAG_ELEVATION = 2
FLAG_DISTANCE_METRICS = 4
FLAG_OBJECTS = 8

@dataclass
class FrameData:
    frame_id: int
    timestamp: float
    
    # Ego vehicle pose
    ego_x: float
    ego_y: float
    ego_heading: float
    
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

    # Detected Objects (optional)
    obj_id: Optional[np.ndarray] = None          # Uint32Array
    obj_type: Optional[np.ndarray] = None        # Uint16Array (semantic_id)
    obj_cx: Optional[np.ndarray] = None          # Float32Array
    obj_cy: Optional[np.ndarray] = None          # Float32Array
    obj_cz: Optional[np.ndarray] = None          # Float32Array
    obj_l: Optional[np.ndarray] = None           # Float32Array
    obj_w: Optional[np.ndarray] = None           # Float32Array
    obj_h: Optional[np.ndarray] = None           # Float32Array
    obj_heading: Optional[np.ndarray] = None     # Float32Array
    obj_conf: Optional[np.ndarray] = None        # Float32Array

    # Extra stats sent to frontend
    num_points: int = 0      # REAL total point count before subsampling
    inference_fps: float = 0.0  # Backend processing FPS (1000 / total_ms)


def serialize_binary(frame: FrameData) -> bytes:
    flags = 0
    if frame.raw_x is not None:
        flags |= FLAG_RAW_POINTS
    if frame.cell_mean_height is not None:
        flags |= FLAG_ELEVATION
    if frame.band_miou is not None:
        flags |= FLAG_DISTANCE_METRICS
    if frame.obj_id is not None:
        flags |= FLAG_OBJECTS

    cell_count = len(frame.cell_x)
    point_count = len(frame.raw_x) if frame.raw_x is not None else 0
    obj_count = len(frame.obj_id) if frame.obj_id is not None else 0
    
    # Ensure types
    cell_x = frame.cell_x.astype(np.float32)
    cell_y = frame.cell_y.astype(np.float32)
    cell_resolution = frame.cell_resolution.astype(np.float32)
    cell_semantic_id = frame.cell_semantic_id.astype(np.uint16)
    cell_confidence = frame.cell_confidence.astype(np.float32)
    cell_object_height = frame.cell_object_height.astype(np.float32)
    cell_ground_elev = frame.cell_ground_elev.astype(np.float32)
    cell_point_count = frame.cell_point_count.astype(np.uint32)

    # 52-byte header V2
    # magic:          uint32    (0x4C494441 = "LIDA")
    # version:        uint16    (2)
    # flags:          uint16    
    # frame_id:       uint32
    # timestamp:      float64
    # cell_count:     uint32
    # point_count:    uint32    (subsampled raw points for array layout)
    # obj_count:      uint32
    # ego_x:          float32
    # ego_y:          float32
    # ego_heading:    float32
    # num_points:     uint32    (REAL total points before subsampling)
    # inference_fps:  float32   (backend processing fps)
    
    num_pts_real = frame.num_points if frame.num_points > 0 else (len(frame.raw_x) if frame.raw_x is not None else 0)
    
    header = struct.pack(
        "<I H H I d I I I f f f I f",
        MAGIC,
        VERSION,
        flags,
        frame.frame_id,
        frame.timestamp,
        cell_count,
        point_count,
        obj_count,
        frame.ego_x,
        frame.ego_y,
        frame.ego_heading,
        num_pts_real,
        float(frame.inference_fps),
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
        band_count_bytes = struct.pack("<I", band_count) # pad properly to 4 bytes
        
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
        
    if flags & FLAG_OBJECTS:
        obj_id = frame.obj_id.astype(np.uint32)
        obj_type = frame.obj_type.astype(np.uint16)
        obj_cx = frame.obj_cx.astype(np.float32)
        obj_cy = frame.obj_cy.astype(np.float32)
        obj_cz = frame.obj_cz.astype(np.float32)
        obj_l = frame.obj_l.astype(np.float32)
        obj_w = frame.obj_w.astype(np.float32)
        obj_h = frame.obj_h.astype(np.float32)
        obj_heading = frame.obj_heading.astype(np.float32)
        obj_conf = frame.obj_conf.astype(np.float32)
        
        obj_type_bytes = obj_type.tobytes()
        if len(obj_type_bytes) % 4 != 0:
            obj_type_bytes += b'\x00' * (4 - (len(obj_type_bytes) % 4))
            
        payloads.extend([
            obj_id.tobytes(),
            obj_type_bytes,
            obj_cx.tobytes(),
            obj_cy.tobytes(),
            obj_cz.tobytes(),
            obj_l.tobytes(),
            obj_w.tobytes(),
            obj_h.tobytes(),
            obj_heading.tobytes(),
            obj_conf.tobytes()
        ])

    return header + b''.join(payloads)


def deserialize_binary(data: bytes) -> FrameData:
    magic, version, flags, frame_id, timestamp, cell_count, point_count, obj_count, ego_x, ego_y, ego_heading, _ = struct.unpack_from("<I H H I d I I I f f f I", data, 0)
    
    if magic != MAGIC:
        raise ValueError(f"Invalid magic number: {magic}")
    
    offset = 48
    
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
        ego_x=ego_x,
        ego_y=ego_y,
        ego_heading=ego_heading,
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
        band_count = struct.unpack_from("<I", data, offset)[0]
        offset += 4
        frame.band_miou = read_array(np.float32, band_count)
        frame.band_accuracy = read_array(np.float32, band_count)
        frame.band_point_count = read_array(np.uint32, band_count)
        frame.band_mean_conf = read_array(np.float32, band_count)
        
    if flags & FLAG_OBJECTS:
        frame.obj_id = read_array(np.uint32, obj_count)
        frame.obj_type = read_array(np.uint16, obj_count)
        frame.obj_cx = read_array(np.float32, obj_count)
        frame.obj_cy = read_array(np.float32, obj_count)
        frame.obj_cz = read_array(np.float32, obj_count)
        frame.obj_l = read_array(np.float32, obj_count)
        frame.obj_w = read_array(np.float32, obj_count)
        frame.obj_h = read_array(np.float32, obj_count)
        frame.obj_heading = read_array(np.float32, obj_count)
        frame.obj_conf = read_array(np.float32, obj_count)

    return frame


def serialize_json(frame: FrameData) -> str:
    res = {
        "frame_id": frame.frame_id,
        "timestamp": frame.timestamp,
        "ego_x": frame.ego_x,
        "ego_y": frame.ego_y,
        "ego_heading": frame.ego_heading,
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
        
    if frame.obj_id is not None:
        res["obj_id"] = frame.obj_id.tolist()
        res["obj_type"] = frame.obj_type.tolist()
        res["obj_cx"] = frame.obj_cx.tolist()
        res["obj_cy"] = frame.obj_cy.tolist()
        res["obj_cz"] = frame.obj_cz.tolist()
        res["obj_l"] = frame.obj_l.tolist()
        res["obj_w"] = frame.obj_w.tolist()
        res["obj_h"] = frame.obj_h.tolist()
        res["obj_heading"] = frame.obj_heading.tolist()
        res["obj_conf"] = frame.obj_conf.tolist()

    # Always include real point count and backend FPS
    res["num_points"] = frame.num_points
    res["inference_fps"] = frame.inference_fps

    return json.dumps(res)

