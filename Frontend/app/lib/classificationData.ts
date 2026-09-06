export type ClassificationCategory = 'terrain' | 'static' | 'dynamic' | 'unknown';

export interface ClassificationEntry {
  id: string;
  label: string;
  color: string;
  category: ClassificationCategory;
}

// Master configuration based on the provided image dataset classes
export const CLASSIFICATION_CONFIG: Record<string, Record<string, ClassificationEntry>> = {
  ground: {
    road: { id: 'road', label: 'road', color: '#4a90d9', category: 'terrain' },
    sidewalk: { id: 'sidewalk', label: 'sidewalk', color: '#8b8c89', category: 'terrain' },
    parking: { id: 'parking', label: 'parking', color: '#685473', category: 'terrain' },
    'other-ground': { id: 'other-ground', label: 'other-ground', color: '#a37198', category: 'terrain' },
  },
  structure: {
    building: { id: 'building', label: 'building', color: '#7a8224', category: 'terrain' },
    'other-structure': { id: 'other-structure', label: 'other-structure', color: '#b5ba59', category: 'terrain' },
  },
  vehicle: {
    car: { id: 'car', label: 'car', color: '#163f59', category: 'dynamic' },
    truck: { id: 'truck', label: 'truck', color: '#5b8a9c', category: 'dynamic' },
    bicycle: { id: 'bicycle', label: 'bicycle', color: '#398bba', category: 'dynamic' },
    motorcycle: { id: 'motorcycle', label: 'motorcycle', color: '#3fb2e3', category: 'dynamic' },
    'other-vehicle': { id: 'other-vehicle', label: 'other-vehicle', color: '#7ad4fa', category: 'dynamic' },
  },
  nature: {
    vegetation: { id: 'vegetation', label: 'vegetation', color: '#1d3615', category: 'terrain' },
    trunk: { id: 'trunk', label: 'trunk', color: '#3d6132', category: 'static' },
    terrain: { id: 'terrain', label: 'terrain', color: '#66ab66', category: 'terrain' },
  },
  human: {
    person: { id: 'person', label: 'person', color: '#733333', category: 'dynamic' },
    bicyclist: { id: 'bicyclist', label: 'bicyclist', color: '#d15e5e', category: 'dynamic' },
    motorcyclist: { id: 'motorcyclist', label: 'motorcyclist', color: '#e34f4f', category: 'dynamic' },
  },
  object: {
    fence: { id: 'fence', label: 'fence', color: '#733c16', category: 'static' },
    pole: { id: 'pole', label: 'pole', color: '#9e6234', category: 'static' },
    'traffic sign': { id: 'traffic sign', label: 'traffic sign', color: '#c76e2c', category: 'static' },
    'other-object': { id: 'other-object', label: 'other-object', color: '#f59b56', category: 'static' },
  },
  outlier: {
    outlier: { id: 'outlier', label: 'outlier', color: '#6b6b6b', category: 'unknown' },
  }
};

// Flattened lookup tables
export const SEMANTIC_COLORS_HEX: Record<string, string> = {};
export const OBJ_TYPE_COLORS: Record<string, string> = {};
export const STATIC_OBJECT_TYPES = new Set<string>();
export const DYNAMIC_OBJECT_TYPES = new Set<string>();

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ] : [0.55, 0.55, 0.55];
};

export const LIDAR_RGB: Record<string, [number, number, number]> = {};

Object.values(CLASSIFICATION_CONFIG).forEach(group => {
  Object.values(group).forEach(entry => {
    SEMANTIC_COLORS_HEX[entry.id] = entry.color;
    OBJ_TYPE_COLORS[entry.id] = entry.color;
    LIDAR_RGB[entry.id] = hexToRgb(entry.color);

    if (entry.category === 'static') {
      STATIC_OBJECT_TYPES.add(entry.id);
    } else if (entry.category === 'dynamic') {
      DYNAMIC_OBJECT_TYPES.add(entry.id);
    }
  });
});

// Also keep drivable/non-drivable defaults if anything else depends on them implicitly
SEMANTIC_COLORS_HEX['drivable'] = '#4a90d9';
SEMANTIC_COLORS_HEX['non-drivable'] = '#8b8c89';
