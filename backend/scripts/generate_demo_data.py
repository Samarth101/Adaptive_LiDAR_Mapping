import json
import numpy as np

# Road parameters
road_width = 14.0 # 7m each side
radius = 180.0

lidar_points = []
map_cells = []

# Generate points in a circle for terrain and road
num_points = 250000
radii = np.random.uniform(0, radius, num_points)
angles = np.random.uniform(0, 2 * np.pi, num_points)

xs = radii * np.cos(angles)
ys = radii * np.sin(angles)

for x, y in zip(xs, ys):
    z = -1.5 + np.random.uniform(-0.1, 0.1)
    classification = "terrain"
    intensity = np.random.uniform(0.2, 0.5)

    is_road_x = abs(y) <= road_width / 2  # East-West road
    is_road_y = abs(x) <= road_width / 2  # North-South road

    if is_road_x or is_road_y:
        classification = "road"
        z = -1.6 + np.random.uniform(-0.02, 0.02)
        intensity = np.random.uniform(0.1, 0.3)
        # Adding some lane markings
        if (is_road_x and abs(y) < 0.2) or (is_road_y and abs(x) < 0.2):
            intensity = 0.9 # lane marking
        lidar_points.append({
            "position": [float(x), float(y), float(z)],
            "intensity": float(intensity),
            "classification": classification
        })
    else:
        # We handle buildings explicitly, so just keep some terrain/vegetation
        if np.random.rand() < 0.1:
            classification = "vegetation"
            z = -1.5 + np.random.uniform(0, 4.0)
            intensity = np.random.uniform(0.5, 0.8)
            lidar_points.append({
                "position": [float(x), float(y), float(z)],
                "intensity": float(intensity),
                "classification": classification
            })
        else:
            lidar_points.append({
                "position": [float(x), float(y), float(z)],
                "intensity": float(intensity),
                "classification": classification
            })

# Generate 4 explicit building blocks on the corners of the intersection
def add_building_block(min_x, max_x, min_y, max_y, height):
    num_b_points = int(30000 * (max_x - min_x) * (max_y - min_y) / 900)
    b_xs = np.random.uniform(min_x, max_x, num_b_points)
    b_ys = np.random.uniform(min_y, max_y, num_b_points)
    b_zs = np.random.uniform(-1.5, height, num_b_points)
    
    # We only want points on the outer walls and roof for realistic LiDAR
    for bx, by, bz in zip(b_xs, b_ys, b_zs):
        is_roof = (height - bz) < 0.5
        is_wall_x = abs(bx - min_x) < 0.5 or abs(bx - max_x) < 0.5
        is_wall_y = abs(by - min_y) < 0.5 or abs(by - max_y) < 0.5
        
        if is_roof or is_wall_x or is_wall_y:
            lidar_points.append({
                "position": [float(bx), float(by), float(bz)],
                "intensity": np.random.uniform(0.3, 0.6),
                "classification": "building"
            })

add_building_block(10, 40, 10, 40, 15)   # NE building
add_building_block(-40, -10, 10, 40, 10) # NW building
add_building_block(-40, -10, -40, -10, 20) # SW building
add_building_block(10, 40, -40, -10, 12)  # SE building

# Generate Traffic Lights at the 4 corners of the intersection
def add_traffic_light(tx, ty):
    # Pole
    pz = np.linspace(-1.5, 3.5, 50)
    for z in pz:
        lidar_points.append({
            "position": [float(tx), float(ty), float(z)],
            "intensity": 0.8,
            "classification": "pole"
        })
    # Light Box
    lx = np.random.uniform(tx - 0.2, tx + 0.2, 50)
    ly = np.random.uniform(ty - 0.2, ty + 0.2, 50)
    lz = np.random.uniform(3.0, 3.8, 50)
    for x, y, z in zip(lx, ly, lz):
        lidar_points.append({
            "position": [float(x), float(y), float(z)],
            "intensity": 0.9,
            "classification": "traffic-sign"
        })

add_traffic_light(8, 8)
add_traffic_light(-8, 8)
add_traffic_light(8, -8)
add_traffic_light(-8, -8)


frames = []
for i in range(150):
    # Ego vehicle moves from West to East (along +X)
    t = i / 149.0
    
    x = -60 + t * 120 # from -60 to +60
    y = 3.5 # Right lane
    heading = 0.0 # pointing +X
    
    detected_objects = []
    
    # Removed Traffic Lights as static objects
    
    # 1. Car coming from North to South (cross traffic)
    cy = -60 + (t + 0.2) * 120
    cx = 3.5
    detected_objects.append({
        "id": 1, "type": "car",
        "position": [float(cx), float(cy), -0.85],
        "size": [4.5, 2.0, 1.5],
        "velocity": [0.0, 15.0, 0.0],
        "heading": np.pi/2,
        "confidence": 0.95,
        "risk": 0.1
    })

    # 2. Car going East to West (oncoming traffic)
    cx2 = 60 - (t - 0.2) * 120
    cy2 = -3.5
    detected_objects.append({
        "id": 2, "type": "truck",
        "position": [float(cx2), float(cy2), -0.1],
        "size": [8.0, 2.5, 3.0],
        "velocity": [-15.0, 0.0, 0.0],
        "heading": np.pi,
        "confidence": 0.92,
        "risk": 0.2
    })
    
    # 3. Car coming South to North
    cx3 = -3.5
    cy3 = 60 - (t + 0.3) * 120
    detected_objects.append({
        "id": 3, "type": "car",
        "position": [float(cx3), float(cy3), -0.9],
        "size": [4.0, 1.8, 1.4],
        "velocity": [0.0, -15.0, 0.0],
        "heading": -np.pi / 2,
        "confidence": 0.98,
        "risk": 0.05
    })
    
    # 4. Pedestrian crossing
    px = 12.0
    py = 10.0 - t * 20.0
    detected_objects.append({
        "id": 4, "type": "person",
        "position": [float(px), float(py), -0.7],
        "size": [0.8, 0.8, 1.8],
        "velocity": [0.0, -2.0, 0.0],
        "heading": -np.pi / 2,
        "confidence": 0.85,
        "risk": 0.5 if abs(px - x) < 10 else 0.1
    })

    # 5. Bicycle moving parallel to ego
    bx = -50 + t * 100
    by = 6.0
    detected_objects.append({
        "id": 5, "type": "bicycle",
        "position": [float(bx), float(by), -0.85],
        "size": [1.5, 0.6, 1.5], "velocity": [12.0, 0.0, 0.0], "heading": 0, "confidence": 0.88, "risk": 0.0
    })

    # 6. Motorcycle crossing
    detected_objects.append({
        "id": 6, "type": "motorcycle",
        "position": [float(2.0), float(-40 + (t - 0.3) * 80), -0.85],
        "size": [2.0, 0.8, 1.5], "velocity": [0.0, 10.0, 0.0], "heading": np.pi/2, "confidence": 0.90, "risk": 0.0
    })

    # 7. Bicyclist riding
    detected_objects.append({
        "id": 7, "type": "bicyclist",
        "position": [float(-30 + (t + 0.1) * 60), float(8.0), -0.85],
        "size": [1.6, 0.7, 1.6], "velocity": [8.0, 0.0, 0.0], "heading": 0, "confidence": 0.91, "risk": 0.0
    })

    # 8. Motorcyclist riding
    detected_objects.append({
        "id": 8, "type": "motorcyclist",
        "position": [float(40 - (t + 0.1) * 80), float(-6.0), -0.85],
        "size": [2.1, 0.9, 1.6], "velocity": [-10.0, 0.0, 0.0], "heading": np.pi, "confidence": 0.93, "risk": 0.0
    })

    # 9. Other vehicle (auto rickshaw/van)
    detected_objects.append({
        "id": 9, "type": "other-vehicle",
        "position": [float(-4.0), float(40 - (t + 0.4) * 80), -0.1],
        "size": [3.0, 1.5, 2.0], "velocity": [0.0, -10.0, 0.0], "heading": -np.pi/2, "confidence": 0.89, "risk": 0.0
    })

    # 10. Extra Car 1 (fast moving left lane)
    detected_objects.append({
        "id": 10, "type": "car",
        "position": [float(-80 + (t - 0.4) * 160), float(0.0), -0.85],
        "size": [4.6, 2.0, 1.5], "velocity": [20.0, 0.0, 0.0], "heading": 0, "confidence": 0.97, "risk": 0.1
    })

    # 11. Extra Car 2 (turning/crossing)
    detected_objects.append({
        "id": 11, "type": "car",
        "position": [float(-8.0), float(-80 + (t - 0.1) * 160), -0.85],
        "size": [4.2, 1.9, 1.4], "velocity": [0.0, 20.0, 0.0], "heading": np.pi/2, "confidence": 0.96, "risk": 0.1
    })

    frame = {
        "frame_id": i,
        "timestamp": 1600000000000 + i * 100,
        "vehicle": {
            "position": [float(x), float(y), -1.6],
            "heading": float(heading),
            "speed_kmh": 40.0,
            "acceleration": 0.0,
            "steering_angle": 0.0
        },
        "detected_objects": detected_objects,
        "planned_path": [],
        "predicted_trajectories": [],
        "metrics": {
            "latency_ms": 45,
            "perception_latency_ms": 20,
            "mapping_latency_ms": 15,
            "planning_latency_ms": 5,
            "control_latency_ms": 5,
            "objects_detected": len(detected_objects),
            "collision_risk": 0.1,
            "path_smoothness": 0.9,
            "success_rate": 0.99
        }
    }
    frames.append(frame)

data = {
    "static_environment": {
        "lidar_points": lidar_points,
        "map_cells": map_cells
    },
    "frames": frames
}

import os

# Save the JSON file in public/data relative to this script's location
output_path = os.path.join(os.path.dirname(__file__), "public", "data", "autonomous_driving_demo_data.json")
os.makedirs(os.path.dirname(output_path), exist_ok=True)

with open(output_path, "w") as f:
    json.dump(data, f)
print(f"Demo data generated successfully at {output_path}")
