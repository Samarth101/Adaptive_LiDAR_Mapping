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
    road: { id: 'road', label: 'road', color: '#ff00ff', category: 'terrain' }, // magenta
    sidewalk: { id: 'sidewalk', label: 'sidewalk', color: '#4b004b', category: 'terrain' }, // dark magenta
    parking: { id: 'parking', label: 'parking', color: '#ff96ff', category: 'terrain' }, // light pink
    'other-ground': { id: 'other-ground', label: 'other-ground', color: '#af004b', category: 'terrain' }, // dark pink
  },
  structure: {
    building: { id: 'building', label: 'building', color: '#ffc800', category: 'terrain' }, // orange-yellow
    'other-structure': { id: 'other-structure', label: 'other-structure', color: '#ffc800', category: 'terrain' },
  },
  vehicle: {
    car: { id: 'car', label: 'car', color: '#6496f5', category: 'dynamic' }, // blue
    truck: { id: 'truck', label: 'truck', color: '#501eb4', category: 'dynamic' }, // purple
    bicycle: { id: 'bicycle', label: 'bicycle', color: '#64e6f5', category: 'dynamic' }, // cyan
    motorcycle: { id: 'motorcycle', label: 'motorcycle', color: '#1e3c96', category: 'dynamic' }, // dark blue
    'other-vehicle': { id: 'other-vehicle', label: 'other-vehicle', color: '#0000ff', category: 'dynamic' }, // red -> wait backend said red but (0,0,255) is blue! Let's use blue
  },
  nature: {
    vegetation: { id: 'vegetation', label: 'vegetation', color: '#00af00', category: 'terrain' }, // green
    trunk: { id: 'trunk', label: 'trunk', color: '#873c00', category: 'static' }, // brown
    terrain: { id: 'terrain', label: 'terrain', color: '#96f050', category: 'terrain' }, // lime green
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
