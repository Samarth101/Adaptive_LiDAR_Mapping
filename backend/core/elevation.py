import numpy as np
from typing import Dict, List, Tuple
from backend.core.adaptive_grid import AdaptiveCell

def estimate_ground_plane(points: np.ndarray, max_iterations: int = 100, threshold: float = 0.2) -> Tuple[float, float, float, float]:
    """
    Estimates the ground plane equation ax + by + cz + d = 0 using a RANSAC approach.
    Returns the plane coefficients (a, b, c, d).
    """
    if len(points) < 3:
        return (0.0, 0.0, 1.0, 0.0)

    # Heuristic: limit candidates to lower subset of points to improve speed
    z_min = np.percentile(points[:, 2], 5)
    z_max = z_min + 2.0
    mask = (points[:, 2] >= z_min) & (points[:, 2] <= z_max)
    subset = points[mask]
    
    if len(subset) < 3:
        subset = points

    best_inliers = 0
    best_plane = (0.0, 0.0, 1.0, -np.mean(subset[:, 2]))

    for _ in range(max_iterations):
        # Sample 3 random points
        idx = np.random.choice(len(subset), 3, replace=False)
        p1, p2, p3 = subset[idx]

        # Calculate normal vector
        v1 = p2 - p1
        v2 = p3 - p1
        normal = np.cross(v1, v2)
        norm = np.linalg.norm(normal)
        if norm < 1e-6:
            continue
            
        normal = normal / norm
        a, b, c = normal
        d = -np.dot(normal, p1)

        # Count inliers
        distances = np.abs(np.dot(subset, normal) + d)
        inliers = np.sum(distances < threshold)

        if inliers > best_inliers:
            best_inliers = inliers
            best_plane = (a, b, c, d)

    return best_plane


def compute_height_above_ground(points: np.ndarray, ground_params: Tuple[float, float, float, float]) -> np.ndarray:
    """
    Computes the relative height of points above the estimated ground plane.
    """
    a, b, c, d = ground_params
    
    # Ensure normal points upwards (positive z direction)
    if c < 0:
        a, b, c, d = -a, -b, -c, -d

    # Protect against purely vertical planes, shouldn't occur for ground
    if np.abs(c) < 1e-6:
        return points[:, 2]

    # Z_ground = -(ax + by + d) / c
    z_ground = -(a * points[:, 0] + b * points[:, 1] + d) / c
    return points[:, 2] - z_ground


def process_elevation(cells: List[AdaptiveCell]) -> Dict[str, np.ndarray]:
    """
    Processes the grid cells to generate elevation data arrays for the frontend.
    Returns a dictionary of arrays.
    """
    if not cells:
        return {}
        
    ground_elev = np.array([c.ground_elevation for c in cells], dtype=np.float32)
    mean_h = np.array([c.mean_height for c in cells], dtype=np.float32)
    roughness = np.array([c.height_variance for c in cells], dtype=np.float32)
    
    # Compute continuous colormap gradient [0, 1] based on mean height
    min_h = np.min(mean_h)
    max_h = np.max(mean_h)
    rng = max_h - min_h
    
    if rng > 1e-6:
        gradient = (mean_h - min_h) / rng
    else:
        gradient = np.zeros_like(mean_h)
        
    return {
        'ground_elevation': ground_elev,
        'mean_height': mean_h,
        'height_gradient': gradient.astype(np.float32),
        'terrain_roughness': roughness
    }


def classify_terrain(cells: List[AdaptiveCell], flat_thresh: float = 0.05, sloped_thresh: float = 0.2) -> np.ndarray:
    """
    Classifies the terrain of each cell into 'flat', 'sloped', or 'rough' 
    based on the height variance.
    """
    if not cells:
        return np.array([])
        
    roughness = np.array([c.height_variance for c in cells])
    classes = np.full(len(cells), 'rough', dtype=object)
    
    classes[roughness < flat_thresh] = 'flat'
    classes[(roughness >= flat_thresh) & (roughness < sloped_thresh)] = 'sloped'
    
    return classes
