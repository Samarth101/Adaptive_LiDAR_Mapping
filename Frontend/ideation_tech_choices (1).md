# Ideation

## Product Direction
Build a software-based autonomous driving demo for unstructured Indian roads using public data, perception models, adaptive 2.5D mapping, path planning, and simulation.

---

## 1. Data Collection Solution
**Purpose:** Get usable input data without physical LiDAR, camera, or radar.

**What this solution does:**
- uses internet datasets as sensor input
- provides LiDAR point clouds, images, annotations, and object labels
- helps train, test, and validate the software pipeline

**What is required to build it:**
- public datasets such as **nuScenes**, **KITTI**, **Waymo Open Dataset**, **IDD**
- dataset loader scripts
- frame synchronization
- annotation parsing

**Tech needed:**
- **Python** for dataset loading and preprocessing
- **MATLAB** only if you want to import processed data into the demo pipeline

**Best choice:**
- **Use Python first** for loading and preparing dataset data
- **Use MATLAB also** if the final demo is in MATLAB/Simulink

**Decision:** **Python + MATLAB** is best

---

## 2. Scenario Creation Solution
**Purpose:** Build custom Indian-road test cases that may not exist in datasets.

**What this solution does:**
- creates village roads, market roads, urban intersections, highway merges, and cattle-crossing scenes
- gives controlled testing conditions
- makes the final demo more realistic and presentable

**What is required to build it:**
- road geometry
- traffic actors
- pedestrians and animals
- event logic for sudden movements

**Tech needed:**
- **RoadRunner** for scene design
- **Simulink** for running scenario-based simulation
- **MATLAB** for configuration and integration

**Best choice:**
- if you want only road scene design, **RoadRunner** is enough
- if you want scenes to interact with planning and vehicle motion, use **RoadRunner + Simulink + MATLAB**

**Decision:** **Use all 3 together** for best results

---

## 3. Sensor Input Solution
**Purpose:** Decide how the software gets LiDAR/camera/radar-like input.

**What this solution does:**
- feeds the perception module
- supports both real-world dataset input and synthetic simulation input

**What is required to build it:**
- dataset readers for public data
- simulated sensors if using virtual testing
- common format for sensor frames

**Tech needed:**
- **Python** for dataset input
- **Automated Driving Toolbox** for simulated sensors
- **Simulink** for sensor pipeline integration

**Best choice:**
- for realism: use **public datasets**
- for controllable demo scenarios: use **simulated sensors**
- for strongest project: use **both**

**Decision:** **Python + Automated Driving Toolbox + Simulink**

---

## 4. Perception Solution
**Purpose:** Detect drivable terrain, obstacles, and moving objects.

**What this solution does:**
- identifies road and non-road area
- detects pedestrians, vehicles, animals, poles, potholes, and obstacles
- gives structured output for mapping and planning

**What is required to build it:**
- trained model for detection or segmentation
- inference pipeline
- label mapping
- tracking logic for dynamic objects

**Tech needed:**
- **Python** if your model is already built there
- **MATLAB Deep Learning Toolbox** only if you want to import or run the model in MATLAB
- **Lidar Toolbox** for point-cloud related processing

**Best choice:**
- if your team already built the model in Python, keep training/inference in **Python**
- use **MATLAB** only for integration, not for rebuilding the whole model unless needed

**Decision:** **Python + MATLAB integration** is best

---

## 5. LiDAR Preprocessing Solution
**Purpose:** Clean raw LiDAR point clouds before mapping and detection.

**What this solution does:**
- removes noise
- crops unnecessary points
- reduces data size for faster processing

**What is required to build it:**
- denoising
- outlier removal
- downsampling
- coordinate conversion

**Tech needed:**
- **Python** or **MATLAB Lidar Toolbox**

**Best choice:**
- if preprocessing is already part of your Python pipeline, keep it in **Python**
- if you want smooth integration with mapping inside MATLAB, do it in **MATLAB Lidar Toolbox**

**Decision:** **MATLAB Lidar Toolbox** is better for final demo integration

---

## 6. Adaptive 2.5D Mapping Solution
**Purpose:** Convert 3D point clouds into a variable-resolution 2.5D semantic map.

**What this solution does:**
- creates high-resolution cells near the vehicle
- creates lower-resolution cells far away
- stores height, terrain type, and obstacle information per cell
- reduces memory use while preserving important nearby detail

**What is required to build it:**
- point cloud to top-view projection
- distance-based grid sizing logic
- semantic label assignment
- elevation storage
- visualization of the final map

**Tech needed:**
- **MATLAB**
- **Lidar Toolbox**

**Best choice:**
- this module is best implemented in **MATLAB** because it fits naturally with simulation, plotting, and planning

**Decision:** **Use MATLAB + Lidar Toolbox**

---

## 7. Motion Prediction Solution
**Purpose:** Predict short future movement of nearby agents.

**What this solution does:**
- predicts where pedestrians, vehicles, and animals may move next
- helps the planner avoid future collisions

**What is required to build it:**
- tracked object history
- prediction model or rule-based motion logic
- trajectory output for the planner

**Tech needed:**
- **Python** if you already have or want to build the prediction model there
- **MATLAB** if you want to use prediction output directly inside the simulator

**Best choice:**
- build the predictor in **Python**
- pass prediction output to **MATLAB/Simulink** for planning

**Decision:** **Python + MATLAB**

---

## 8. Path Planning Solution
**Purpose:** Generate a safe local path around obstacles.

**What this solution does:**
- uses the adaptive map and predicted agent motion
- generates a collision-free path
- replans when the environment changes

**What is required to build it:**
- drivable area cost map
- local goal selection
- dynamic obstacle handling
- replanning loop

**Tech needed:**
- **MATLAB**
- **Navigation Toolbox**

**Best choice:**
- this should be implemented in **MATLAB** for easy integration with the map and simulation

**Decision:** **Use MATLAB + Navigation Toolbox**

---

## 9. Collision Avoidance and Decision Solution
**Purpose:** Decide whether the vehicle should slow, stop, bypass, or steer away.

**What this solution does:**
- reacts to sudden pedestrian motion, cattle crossing, blocked roads, and irregular merging
- converts planning output into safe tactical decisions

**What is required to build it:**
- decision rules
- risk thresholds
- event handling logic
- command generation for control module

**Tech needed:**
- **Stateflow**
- **Simulink**

**Best choice:**
- if you want visual decision logic and state-based behavior, **Stateflow + Simulink** is the best option

**Decision:** **Use Stateflow + Simulink**

---

## 10. Vehicle Control Solution
**Purpose:** Make the vehicle follow the planned path realistically.

**What this solution does:**
- controls steering and speed
- validates whether the planned path is physically followable

**What is required to build it:**
- steering controller
- speed controller
- vehicle model
- path tracking logic

**Tech needed:**
- **Simulink**
- **Vehicle Dynamics Blockset** or a **bicycle model**

**Best choice:**
- for a simple prototype, use a **bicycle model**
- for a stronger demo, use **Vehicle Dynamics Blockset** with Simulink

**Decision:** **Simulink + bicycle model** for simple build, or **Simulink + Vehicle Dynamics Blockset** for better demo

---

## 11. Visualization and Evaluation Solution
**Purpose:** Show results and prove the system works.

**What this solution does:**
- visualizes detections, map, path, and vehicle motion
- reports latency, collision rate, path smoothness, and success rate

**What is required to build it:**
- live plots or dashboard
- scenario playback
- metrics computation
- comparison graphs

**Tech needed:**
- **MATLAB** for plots and metrics
- **Simulink** if you want live simulation dashboard

**Best choice:**
- use **MATLAB** for analysis and charts
- use **Simulink** too if you want a live interactive demo

**Decision:** **MATLAB + Simulink**

---

## Recommended Overall Stack

### Best practical combination
- **Python** for dataset handling and existing perception / prediction models
- **MATLAB** for adaptive 2.5D mapping, planning, visualization, and integration
- **Simulink** for system simulation, decision logic, and vehicle control
- **RoadRunner** for custom Indian-road scenarios

### Do we need all of them?
- **Python only**: good for research prototype, weak for full demo
- **MATLAB + Simulink only**: good for simulation demo, weaker if your strongest models already exist in Python
- **MATLAB + Simulink + RoadRunner**: best for simulation side
- **Python + MATLAB + Simulink + RoadRunner**: best overall and most feasible for your team

## Final Recommendation
**Use Python + MATLAB + Simulink + RoadRunner**

### Why this is best
- reuses your existing Python model work
- avoids rebuilding everything in MATLAB
- gives strong simulation and demo capability
- supports custom Indian-road scenarios
- makes mapping, planning, and visualization easier

## Final Build Flow
1. collect and preprocess public dataset data in Python
2. run perception / prediction model in Python
3. send processed outputs to MATLAB
4. build adaptive 2.5D map in MATLAB
5. plan path in MATLAB
6. run decision and vehicle simulation in Simulink
7. test custom scenarios from RoadRunner
8. visualize final results in MATLAB / Simulink