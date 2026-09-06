import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import List, Dict, Any

from backend.config import ResolutionBand

@dataclass
class AdaptiveCell:
    """
    Represents a single cell in the adaptive foveated grid.
    """
    x: float
    y: float
    resolution: float
    ground_elevation: float
    max_height: float
    object_height: float
    semantic_id: int
    semantic_confidence: float
    point_count: int
    distance_band: int
    mean_height: float
    height_variance: float


def assign_distance_band(points: np.ndarray, bands: List[ResolutionBand]) -> np.ndarray:
    """
    Assigns each point to a distance band index based on horizontal distance.
    """
    distances = np.linalg.norm(points[:, :2], axis=1)
    band_indices = np.full(len(points), -1, dtype=np.int32)
    for i, band in enumerate(bands):
        mask = (distances >= band.min_distance) & (distances < band.max_distance)
        band_indices[mask] = i
    return band_indices


def assign_resolution(points: np.ndarray, bands: List[ResolutionBand]) -> np.ndarray:
    """
    Assigns spatial resolution to each point based on the defined bands.
    """
    distances = np.linalg.norm(points[:, :2], axis=1)
    resolutions = np.full(len(points), -1.0, dtype=np.float32)
    for band in bands:
        mask = (distances >= band.min_distance) & (distances < band.max_distance)
        resolutions[mask] = band.cell_size
    return resolutions


def build_adaptive_grid(points: np.ndarray, semantic_ids: np.ndarray, 
                        confidences: np.ndarray, bands: List[ResolutionBand]) -> List[AdaptiveCell]:
    """
    Builds the adaptive grid using confidence-weighted semantic voting and vectorized operations.
    """
    resolutions = assign_resolution(points, bands)
    distance_bands = assign_distance_band(points, bands)
    
    # Filter valid points
    valid_mask = resolutions > 0
    points = points[valid_mask]
    semantic_ids = semantic_ids[valid_mask]
    confidences = confidences[valid_mask]
    resolutions = resolutions[valid_mask]
    distance_bands = distance_bands[valid_mask]
    
    if len(points) == 0:
        return []

    x = points[:, 0]
    y = points[:, 1]
    z = points[:, 2]

    # Calculate cell coordinates
    cell_x = np.floor(x / resolutions).astype(np.int64)
    cell_y = np.floor(y / resolutions).astype(np.int64)
    
    # Use pandas for fast grouping
    df = pd.DataFrame({
        'z': z,
        'cell_x': cell_x,
        'cell_y': cell_y,
        'res': resolutions,
        'band': distance_bands,
        'sem_id': semantic_ids,
        'conf': confidences
    })

    grouped = df.groupby(['res', 'cell_x', 'cell_y'])
    
    # Aggregate geometric and distance properties
    aggs = grouped.agg(
        point_count=('z', 'size'),
        min_z=('z', 'min'),
        max_z=('z', 'max'),
        mean_z=('z', 'mean'),
        var_z=('z', lambda vals: vals.var(ddof=0) if len(vals) > 1 else 0.0),
        band=('band', 'first')
    )
    
    # Confidence-weighted semantic voting
    sem_grouped = df.groupby(['res', 'cell_x', 'cell_y', 'sem_id'])['conf'].sum().reset_index()
    # Identify the semantic class with the maximum confidence per cell
    max_conf_idx = sem_grouped.groupby(['res', 'cell_x', 'cell_y'])['conf'].idxmax()
    best_sems = sem_grouped.loc[max_conf_idx].set_index(['res', 'cell_x', 'cell_y'])
    
    merged = aggs.join(best_sems[['sem_id', 'conf']]).reset_index()
    
    # Compute total confidence in the cell to normalize the top semantic confidence
    total_conf = grouped['conf'].sum().rename('total_conf')
    merged = merged.join(total_conf, on=['res', 'cell_x', 'cell_y'])
    
    # Construct AdaptiveCell instances
    cells = []
    for row in merged.itertuples():
        res = row.res
        
        # Reconstruct metric center coordinates
        c_x = row.cell_x * res
        c_y = row.cell_y * res
        
        ground_elev = row.min_z
        max_height = row.max_z
        obj_height = max_height - ground_elev
        
        sem_conf = row.conf / row.total_conf if row.total_conf > 0 else 0.0
        
        cells.append(AdaptiveCell(
            x=c_x,
            y=c_y,
            resolution=res,
            ground_elevation=ground_elev,
            max_height=max_height,
            object_height=obj_height,
            semantic_id=int(row.sem_id),
            semantic_confidence=sem_conf,
            point_count=int(row.point_count),
            distance_band=int(row.band),
            mean_height=row.mean_z,
            height_variance=row.var_z
        ))
        
    return cells


def grid_to_arrays(cells: List[AdaptiveCell]) -> Dict[str, np.ndarray]:
    """
    Converts a list of AdaptiveCells into a dictionary of arrays, 
    suitable for binary serialization or passing to the frontend.
    """
    return {
        'x': np.array([c.x for c in cells], dtype=np.float32),
        'y': np.array([c.y for c in cells], dtype=np.float32),
        'resolution': np.array([c.resolution for c in cells], dtype=np.float32),
        'ground_elevation': np.array([c.ground_elevation for c in cells], dtype=np.float32),
        'max_height': np.array([c.max_height for c in cells], dtype=np.float32),
        'object_height': np.array([c.object_height for c in cells], dtype=np.float32),
        'semantic_id': np.array([c.semantic_id for c in cells], dtype=np.int32),
        'semantic_confidence': np.array([c.semantic_confidence for c in cells], dtype=np.float32),
        'point_count': np.array([c.point_count for c in cells], dtype=np.int32),
        'distance_band': np.array([c.distance_band for c in cells], dtype=np.int32),
        'mean_height': np.array([c.mean_height for c in cells], dtype=np.float32),
        'height_variance': np.array([c.height_variance for c in cells], dtype=np.float32),
    }
