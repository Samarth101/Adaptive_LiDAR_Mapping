// Shared dataset types used across components

export interface FrameMetrics {
  latency_ms: number;
  perception_latency_ms: number;
  mapping_latency_ms: number;
  planning_latency_ms: number;
  control_latency_ms: number;
  objects_detected: number;
  collision_risk: number;
  path_smoothness: number;
  success_rate: number;
}

export interface DetectedObject {
  id: number;
  type: string;
  position: [number, number, number];
  size: [number, number, number];
  velocity: [number, number, number];
  heading: number;
  confidence: number;
  risk: number;
}

export interface PredictedTrajectory {
  object_id: number;
  trajectory: [number, number, number][];
}

export interface Frame {
  frame_id: number;
  timestamp: number;
  vehicle: {
    position: [number, number, number];
    heading: number;
    speed_kmh: number;
    acceleration: number;
    steering_angle: number;
  };
  detected_objects: DetectedObject[];
  planned_path: [number, number, number][];
  predicted_trajectories: PredictedTrajectory[];
  metrics: FrameMetrics;
}

export interface LidarPoint {
  position: [number, number, number];
  intensity: number;
  classification: string;
}

export interface MapCell {
  center: [number, number];
  size: number;
  elevation: number;
  terrain: string;
  occupancy: number;
  semantic: string;
  zone: 'near' | 'mid' | 'far';
}

export interface DemoData {
  static_environment: {
    lidar_points: LidarPoint[];
    map_cells: MapCell[];
  };
  frames: Frame[];
}
