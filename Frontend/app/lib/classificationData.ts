export type ClassificationCategory = 'terrain' | 'static' | 'dynamic' | 'unknown';

export interface ClassificationEntry {
  id: string;
  label: string;
  color: string;
  category: ClassificationCategory;
}

// Master configuration using beautiful standard self-driving palette
export const CLASSIFICATION_CONFIG: Record<string, Record<string, ClassificationEntry>> = {
  ground: {
    road: { id: 'road', label: 'road', color: '#444444', category: 'terrain' }, // dark grey
    sidewalk: { id: 'sidewalk', label: 'sidewalk', color: '#888888', category: 'terrain' }, // light grey
    parking: { id: 'parking', label: 'parking', color: '#666666', category: 'terrain' }, // mid grey
    'other-ground': { id: 'other-ground', label: 'other-ground', color: '#555555', category: 'terrain' }, // grey
  },
  structure: {
    building: { id: 'building', label: 'building', color: '#ffb300', category: 'static' }, // orange-yellow
    'other-structure': { id: 'other-structure', label: 'other-structure', color: '#ffb300', category: 'static' },
  },
  vehicle: {
    car: { id: 'car', label: 'car', color: '#0055ff', category: 'dynamic' }, // bright blue
    truck: { id: 'truck', label: 'truck', color: '#00aaff', category: 'dynamic' }, // cyan
    bicycle: { id: 'bicycle', label: 'bicycle', color: '#ff0055', category: 'dynamic' }, // bright pink/magenta
    motorcycle: { id: 'motorcycle', label: 'motorcycle', color: '#ffaa00', category: 'dynamic' }, // orange
    'other-vehicle': { id: 'other-vehicle', label: 'other-vehicle', color: '#0000ff', category: 'dynamic' }, // dark blue
  },
  nature: {
    vegetation: { id: 'vegetation', label: 'vegetation', color: '#00ff00', category: 'terrain' }, // bright green
    trunk: { id: 'trunk', label: 'trunk', color: '#8b4513', category: 'static' }, // brown
    terrain: { id: 'terrain', label: 'terrain', color: '#55aa00', category: 'terrain' }, // olive green
  },
  human: {
    person: { id: 'person', label: 'person', color: '#ff1e1e', category: 'dynamic' }, // bright red
    bicyclist: { id: 'bicyclist', label: 'bicyclist', color: '#ff28c8', category: 'dynamic' }, // pink
    motorcyclist: { id: 'motorcyclist', label: 'motorcyclist', color: '#961e5a', category: 'dynamic' }, // maroon
  },
  object: {
    fence: { id: 'fence', label: 'fence', color: '#ff7832', category: 'static' }, // orange
    pole: { id: 'pole', label: 'pole', color: '#fff096', category: 'static' }, // pale yellow
    'traffic-sign': { id: 'traffic-sign', label: 'traffic-sign', color: '#ff0000', category: 'static' }, // red
    'other-object': { id: 'other-object', label: 'other-object', color: '#f59b56', category: 'static' },
  },
  outlier: {
    unlabeled: { id: 'unlabeled', label: 'unlabeled', color: '#000000', category: 'unknown' },
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
