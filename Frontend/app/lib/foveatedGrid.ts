/**
 * foveatedGrid.ts
 * Core Variable-Resolution Grid Engine for Foveated LiDAR Mapping.
 *
 * Zone definitions (matching PS requirements):
 *   Near  (0 - 10 m from ego):   0.5 m cells -- high detail (simulates 5cm scale)
 *   Mid   (10 - 40 m from ego):  1.5 m cells -- 3x aggregated
 *   Far   (40 - 100 m from ego): 3.0 m cells -- 6x aggregated
 *
 * KEY: buildFoveatedGrid() PROJECTS raw LiDAR 3D points into variable-size 2D cells.
 * This is the core PS requirement: "projects classified 3D points into a 2.5D grid".
 * Each cell's elevation = max Z of all LiDAR points that fall inside that cell.
 * Each cell's semantic  = dominant classification of those points (majority vote).
 */

import type { LidarPoint, DetectedObject } from '../types/dataset';

// -- Zone boundaries (metres from ego) ----------------------------------------
// PS Requirement: high resolution within a 10m radius, decreasing up to a 100m radius
export const NEAR_RADIUS = 10;
export const MID_RADIUS  = 30;
export const FAR_RADIUS  = 100;

// Cell size per zone: each range has a distinct cell size
// Near (0-10m):   5cm (0.05m) cells
// Mid  (10-30m): 50cm (0.50m) cells
// Far  (30-100m): 100cm (1.00m) cells
export const NEAR_CELL_SIZE = 0.05;
export const MID_CELL_SIZE  = 0.50;
export const FAR_CELL_SIZE  = 1.00;

import {
  SEMANTIC_COLORS_HEX,
  OBJ_TYPE_COLORS,
  STATIC_OBJECT_TYPES,
  DYNAMIC_OBJECT_TYPES
} from './classificationData';

export {
  SEMANTIC_COLORS_HEX,
  OBJ_TYPE_COLORS,
  STATIC_OBJECT_TYPES,
  DYNAMIC_OBJECT_TYPES
};

export function getObjectClass(type: string): 'static' | 'dynamic' | 'unknown' {
  if (STATIC_OBJECT_TYPES.has(type))  return 'static';
  if (DYNAMIC_OBJECT_TYPES.has(type)) return 'dynamic';
  return 'unknown';
}

// Static objects get a dashed border; dynamic objects get a solid + pulsing border
export const STATIC_BORDER_STYLE  = '#e5e5e5';  // white-ish
export const DYNAMIC_BORDER_STYLE = '#00e5ff';  // cyan

// -- Output types -------------------------------------------------------------
export interface GridCell {
  cx: number;           // centre X (dataset coords)
  cy: number;           // centre Y (dataset coords)
  size: number;         // cell size in metres (0.5 / 1.5 / 3.0)
  elevation: number;    // max Z of all LiDAR points projected into this cell
  semantic: string;     // dominant LiDAR classification (majority vote)
  zone: 'near' | 'mid' | 'far';
  pointCount: number;   // number of raw LiDAR points projected into this cell
  distFromEgo: number;  // euclidean distance from ego
}

export interface FoveatedGridResult {
  cells: GridCell[];
  nearCount:  number;
  midCount:   number;
  farCount:   number;
  totalCount: number;
  uniformEquivalent: number;  // hypothetical uniform 0.5m cell count
  memorySavingsPct:  number;  // 0-100
}

// Hypothetical uniform 5cm (0.05m) grid covering same extent (200m x 30m)
const UNIFORM_EQUIVALENT =
  Math.ceil(200 / 0.05) * Math.ceil(30 / 0.05); // = 2,400,000

// -- Main engine: PROJECT 3D LiDAR points into variable-resolution 2D cells ---
export function buildFoveatedGrid(
  lidarPoints: LidarPoint[],
  egoX: number,
  egoY: number,
): FoveatedGridResult {
  // Map: "cx_cy_zone" -> accumulator
  const acc = new Map<string, {
    cx: number; cy: number; size: number; zone: 'near' | 'mid' | 'far';
    maxZ: number; classCounts: Record<string, number>; count: number;
    distFromEgo: number;
  }>();

  for (const pt of lidarPoints) {
    const px = pt.position[0];
    const py = pt.position[1];
    const pz = pt.position[2];

    const dx = px - egoX;
    const dy = py - egoY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Determine zone + cell size
    let cellSize: number;
    let zone: 'near' | 'mid' | 'far';
    if (dist <= NEAR_RADIUS) {
      cellSize = NEAR_CELL_SIZE; zone = 'near';
    } else if (dist <= MID_RADIUS) {
      cellSize = MID_CELL_SIZE;  zone = 'mid';
    } else if (dist <= FAR_RADIUS) {
      cellSize = FAR_CELL_SIZE;  zone = 'far';
    } else {
      continue; // outside FAR_RADIUS -- skip
    }

    // Snap point to cell centre (floor to grid, then add half cell)
    const cx = Math.floor(px / cellSize) * cellSize + cellSize / 2;
    const cy = Math.floor(py / cellSize) * cellSize + cellSize / 2;
    const key = cx.toFixed(3) + '_' + cy.toFixed(3) + '_' + zone;

    let cell = acc.get(key);
    if (!cell) {
      const cdx = cx - egoX;
      const cdy = cy - egoY;
      cell = {
        cx, cy, size: cellSize, zone,
        maxZ: pz,
        classCounts: {},
        count: 0,
        distFromEgo: Math.sqrt(cdx * cdx + cdy * cdy),
      };
      acc.set(key, cell);
    }

    // Aggregate: keep max elevation, count classifications (majority vote)
    if (pz > cell.maxZ) cell.maxZ = pz;
    cell.classCounts[pt.classification] = (cell.classCounts[pt.classification] ?? 0) + 1;
    cell.count++;
  }

  // Convert accumulator to GridCell[]
  const cells: GridCell[] = [];
  for (const c of acc.values()) {
    // Majority-vote semantic: pick classification with highest count
    let dominant = 'road';
    let maxCount = 0;
    for (const [cls, cnt] of Object.entries(c.classCounts)) {
      if (cnt > maxCount) { dominant = cls; maxCount = cnt; }
    }

    cells.push({
      cx: c.cx,
      cy: c.cy,
      size: c.size,
      elevation: c.maxZ,
      semantic: dominant,
      zone: c.zone,
      pointCount: c.count,
      distFromEgo: c.distFromEgo,
    });
  }

  const nearCount  = cells.filter(c => c.zone === 'near').length;
  const midCount   = cells.filter(c => c.zone === 'mid').length;
  const farCount   = cells.filter(c => c.zone === 'far').length;
  const totalCount = cells.length;
  const memorySavingsPct = Math.max(0, (1 - totalCount / UNIFORM_EQUIVALENT) * 100);

  return {
    cells,
    nearCount,
    midCount,
    farCount,
    totalCount,
    uniformEquivalent: UNIFORM_EQUIVALENT,
    memorySavingsPct,
  };
}

// -- Helper: semantic colour lookup -------------------------------------------
export function getSemanticColor(semantic: string): string {
  return SEMANTIC_COLORS_HEX[semantic] ?? '#8c8c8c';
}

// -- Helper: object type colour -----------------------------------------------
export function getObjColor(type: string): string {
  return OBJ_TYPE_COLORS[type] ?? '#cccccc';
}

// -- Helper: zone alpha (foveation opacity) -----------------------------------
export function zoneAlpha(zone: 'near' | 'mid' | 'far'): number {
  if (zone === 'near') return 1.0;
  if (zone === 'mid')  return 0.65;
  return 0.35;
}

// -- Helper: distance from ego to detected object -----------------------------
export function objDistFromEgo(
  obj: DetectedObject,
  egoX: number,
  egoY: number,
): number {
  const dx = obj.position[0] - egoX;
  const dy = obj.position[1] - egoY;
  return Math.sqrt(dx * dx + dy * dy);
}
