import re
import os

path = 'backend/core/frame_processor.py'
with open(path, 'r') as f:
    content = f.read()

# 1. Add imports
imports = """
import math
from sklearn.cluster import DBSCAN
"""
content = content.replace("import time", "import time\n" + imports)

# 2. Add pose parser helper
pose_helper = """
def parse_pose(label_root: str, sequence: str, frame_id: int) -> tuple[float, float, float]:
    pose_path = Path(label_root).parent / "sequences" / sequence / "poses.txt"
    if not pose_path.exists():
        return 0.0, 0.0, 0.0
    try:
        with open(pose_path, "r") as f:
            for i, line in enumerate(f):
                if i == frame_id:
                    vals = [float(v) for v in line.strip().split()]
                    tx, ty, tz = vals[3], vals[7], vals[11]
                    r11, r21 = vals[0], vals[4]
                    heading = math.atan2(r21, r11)
                    return float(tx), float(tz), float(heading)
    except Exception:
        pass
    return 0.0, 0.0, 0.0
"""
content = content.replace("class FrameResult:", pose_helper + "\nclass FrameResult:")

# 3. Add ego_x, ego_y, ego_heading to FrameResult
content = content.replace(
    "sequence: str",
    "sequence: str\n    ego_x: float = 0.0\n    ego_y: float = 0.0\n    ego_heading: float = 0.0"
)

# 4. Add objects array to FrameResult
content = content.replace(
    "num_cells: int",
    "num_cells: int\n    objects: list = field(default_factory=list)"
)

# 5. Add logic to extract pose and objects in process_frame
process_frame_end = """        fps = 1000.0 / total_ms if total_ms > 0 else 0.0
        compression = N / len(cells) if cells else 0.0

        # Extract pose
        ego_x, ego_y, ego_heading = parse_pose(self.config.label_root, sequence, frame_id)

        # Detect objects via DBSCAN
        from backend.utils.class_mapping import DYNAMIC_OBJECT_CLASSES
        objects = []
        dyn_pts = []
        dyn_classes = []
        for c in cells:
            if c.semantic_id in DYNAMIC_OBJECT_CLASSES:
                dyn_pts.append([c.x, c.y, c.ground_elevation + c.object_height/2])
                dyn_classes.append(c.semantic_id)
        
        if dyn_pts:
            import numpy as np
            X = np.array(dyn_pts)
            clustering = DBSCAN(eps=1.5, min_samples=3).fit(X)
            labels = clustering.labels_
            n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
            
            for k in range(n_clusters):
                mask = labels == k
                cluster_pts = X[mask]
                cluster_cls = dyn_classes[mask.argmax()] # simplest: take first
                
                cx, cy, cz = cluster_pts.mean(axis=0)
                l = cluster_pts[:,0].max() - cluster_pts[:,0].min() + 0.5
                w = cluster_pts[:,1].max() - cluster_pts[:,1].min() + 0.5
                h = cluster_pts[:,2].max() - cluster_pts[:,2].min() + 0.5
                
                objects.append({
                    "id": k,
                    "type": cluster_cls,
                    "cx": cx, "cy": cy, "cz": cz,
                    "l": l, "w": w, "h": h,
                    "heading": 0.0,
                    "conf": 1.0
                })

        self._frames_processed += 1"""

content = content.replace("        self._frames_processed += 1", process_frame_end)

# 6. Update FrameResult instantiation
content = content.replace(
    "timestamp=time.time(),",
    "timestamp=time.time(),\n            ego_x=ego_x, ego_y=ego_y, ego_heading=ego_heading,\n            objects=objects,"
)

# 7. Update result_to_frame_data to map FrameResult to FrameData
to_frame_data = """        frame_data = FrameData(
            frame_id=result.frame_id,
            timestamp=result.timestamp,
            ego_x=result.ego_x,
            ego_y=result.ego_y,
            ego_heading=result.ego_heading,
            cell_x=cell_x,
            cell_y=cell_y,
            cell_resolution=cell_res,
            cell_semantic_id=cell_sem,
            cell_confidence=cell_conf,
            cell_object_height=cell_obj_h,
            cell_ground_elev=cell_gnd,
            cell_point_count=cell_cnt,
        )
        
        if result.objects:
            import numpy as np
            frame_data.obj_id = np.array([o['id'] for o in result.objects], dtype=np.uint32)
            frame_data.obj_type = np.array([o['type'] for o in result.objects], dtype=np.uint16)
            frame_data.obj_cx = np.array([o['cx'] for o in result.objects], dtype=np.float32)
            frame_data.obj_cy = np.array([o['cy'] for o in result.objects], dtype=np.float32)
            frame_data.obj_cz = np.array([o['cz'] for o in result.objects], dtype=np.float32)
            frame_data.obj_l = np.array([o['l'] for o in result.objects], dtype=np.float32)
            frame_data.obj_w = np.array([o['w'] for o in result.objects], dtype=np.float32)
            frame_data.obj_h = np.array([o['h'] for o in result.objects], dtype=np.float32)
            frame_data.obj_heading = np.array([o['heading'] for o in result.objects], dtype=np.float32)
            frame_data.obj_conf = np.array([o['conf'] for o in result.objects], dtype=np.float32)
"""
content = re.sub(r'        frame_data = FrameData\(.*?\)', to_frame_data, content, flags=re.DOTALL)

with open(path, 'w') as f:
    f.write(content)

print("Patched frame_processor.py")
