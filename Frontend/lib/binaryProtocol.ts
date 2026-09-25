export interface FrameData {
  frame_id: number;
  timestamp: number;
  ego_x: number;
  ego_y: number;
  ego_heading: number;
  
  cell_x: Float32Array;
  cell_y: Float32Array;
  cell_resolution: Float32Array;
  cell_semantic_id: Uint16Array;
  cell_confidence: Float32Array;
  cell_object_height: Float32Array;
  cell_ground_elev: Float32Array;
  cell_point_count: Uint32Array;

  raw_x?: Float32Array;
  raw_y?: Float32Array;
  raw_z?: Float32Array;
  raw_semantic_id?: Uint16Array;
  raw_confidence?: Float32Array;

  cell_mean_height?: Float32Array;
  cell_height_var?: Float32Array;

  band_miou?: Float32Array;
  band_accuracy?: Float32Array;
  band_point_count?: Uint32Array;
  band_mean_conf?: Float32Array;
  
  obj_id?: Uint32Array;
  obj_type?: Uint16Array;
  obj_cx?: Float32Array;
  obj_cy?: Float32Array;
  obj_cz?: Float32Array;
  obj_l?: Float32Array;
  obj_w?: Float32Array;
  obj_h?: Float32Array;
  obj_heading?: Float32Array;
  obj_conf?: Float32Array;

  // Real stats from backend
  num_points: number;      // actual raw point count before subsampling
  inference_fps: number;   // backend processing FPS
}

const MAGIC = 0x4C494441;
const FLAG_RAW_POINTS = 1;
const FLAG_ELEVATION = 2;
const FLAG_DISTANCE_METRICS = 4;
const FLAG_OBJECTS = 8;

export function deserializeBinary(buffer: ArrayBuffer): FrameData {
  const dataView = new DataView(buffer);
  
  const magic = dataView.getUint32(0, true);
  if (magic !== MAGIC) {
    throw new Error(`Invalid magic number: ${magic}`);
  }
  
  // const version = dataView.getUint16(4, true);
  const flags = dataView.getUint16(6, true);
  const frame_id = dataView.getUint32(8, true);
  const timestamp = dataView.getFloat64(12, true);
  const cell_count = dataView.getUint32(20, true);
  const point_count = dataView.getUint32(24, true);   // subsampled count for array layout
  const obj_count = dataView.getUint32(28, true);
  const ego_x = dataView.getFloat32(32, true);
  const ego_y = dataView.getFloat32(36, true);
  const ego_heading = dataView.getFloat32(40, true);
  const num_points = dataView.getUint32(44, true);    // REAL total point count
  const inference_fps = dataView.getFloat32(48, true); // backend processing FPS
  
  let offset = 52;  // expanded header is now 52 bytes
  
  const readArray = <T extends Float32Array | Uint16Array | Uint32Array>(
    Constructor: { new(buffer: ArrayBuffer, byteOffset: number, length: number): T; BYTES_PER_ELEMENT: number },
    count: number
  ): T => {
    const array = new Constructor(buffer, offset, count);
    const bytes = count * Constructor.BYTES_PER_ELEMENT;
    offset += bytes;
    if (bytes % 4 !== 0) {
      offset += 4 - (bytes % 4);
    }
    return array;
  };

  const frame: FrameData = {
    frame_id, timestamp, ego_x, ego_y, ego_heading,
    num_points: num_points || point_count,
    inference_fps: inference_fps || 0,
    cell_x: readArray(Float32Array, cell_count),
    cell_y: readArray(Float32Array, cell_count),
    cell_resolution: readArray(Float32Array, cell_count),
    cell_semantic_id: readArray(Uint16Array, cell_count),
    cell_confidence: readArray(Float32Array, cell_count),
    cell_object_height: readArray(Float32Array, cell_count),
    cell_ground_elev: readArray(Float32Array, cell_count),
    cell_point_count: readArray(Uint32Array, cell_count)
  };

  if (flags & FLAG_RAW_POINTS) {
    frame.raw_x = readArray(Float32Array, point_count);
    frame.raw_y = readArray(Float32Array, point_count);
    frame.raw_z = readArray(Float32Array, point_count);
    frame.raw_semantic_id = readArray(Uint16Array, point_count);
    frame.raw_confidence = readArray(Float32Array, point_count);
  }

  if (flags & FLAG_ELEVATION) {
    frame.cell_mean_height = readArray(Float32Array, cell_count);
    frame.cell_height_var = readArray(Float32Array, cell_count);
  }

  if (flags & FLAG_DISTANCE_METRICS) {
    const band_count = dataView.getUint32(offset, true);
    offset += 4;
    frame.band_miou = readArray(Float32Array, band_count);
    frame.band_accuracy = readArray(Float32Array, band_count);
    frame.band_point_count = readArray(Uint32Array, band_count);
    frame.band_mean_conf = readArray(Float32Array, band_count);
  }
  
  if (flags & FLAG_OBJECTS) {
    frame.obj_id = readArray(Uint32Array, obj_count);
    frame.obj_type = readArray(Uint16Array, obj_count);
    frame.obj_cx = readArray(Float32Array, obj_count);
    frame.obj_cy = readArray(Float32Array, obj_count);
    frame.obj_cz = readArray(Float32Array, obj_count);
    frame.obj_l = readArray(Float32Array, obj_count);
    frame.obj_w = readArray(Float32Array, obj_count);
    frame.obj_h = readArray(Float32Array, obj_count);
    frame.obj_heading = readArray(Float32Array, obj_count);
    frame.obj_conf = readArray(Float32Array, obj_count);
  }

  return frame;
}
