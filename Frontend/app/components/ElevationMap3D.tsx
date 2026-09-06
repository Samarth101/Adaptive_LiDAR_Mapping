'use client';

import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { OrbitView, LightingEffect, AmbientLight, DirectionalLight } from '@deck.gl/core';
import { PolygonLayer } from '@deck.gl/layers';
import type { DemoData } from '../types/dataset';
import { buildFoveatedGrid, OBJ_TYPE_COLORS } from '../lib/foveatedGrid';

// -- Lighting --
const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0
});
const dirLight = new DirectionalLight({
  color: [255, 255, 255],
  intensity: 1.5,
  direction: [-3, -5, -2]
});
const lightingEffect = new LightingEffect({ ambientLight, dirLight });

// -- Height gradient color --
function getHeightColor(z: number): [number, number, number, number] {
  const t = Math.max(0, Math.min(1, (z + 1) / 4));
  const r = Math.max(0, 2 * t - 1) * 255;
  const g = (1 - 2 * Math.abs(t - 0.5)) * 255;
  const b = Math.max(0, 1 - 2 * t) * 255;
  return [r, g, b, 255];
}

// Helper to convert hex to rgb array
function hexToRgb(hex: string): [number, number, number, number] {
  const c = hex.substring(1).split('');
  if (c.length === 3) {
    c[0] = c[0] + c[0]; c[1] = c[1] + c[1]; c[2] = c[2] + c[2];
  }
  const color = parseInt(c.join(''), 16);
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255, 255];
}

export default function ElevationMap3D({ data, frameIdxRef }: { data: DemoData; frameIdxRef: React.RefObject<number> }) {
  const fi = frameIdxRef.current ?? 0;
  const frame = data.frames[fi];
  const egoX = frame.vehicle.position[0];
  const egoY = frame.vehicle.position[1];

  // 1. Get the foveated grid cells
  const gridResult = useMemo(
    () => buildFoveatedGrid(data.static_environment.lidar_points, egoX, egoY),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, fi] // rebuild when frame changes because ego moves
  );

  // 2. Map cells to PolygonLayer polygons
  // PolygonLayer expects [x, y, z] arrays for the contour
  const terrainData = useMemo(() => {
    return gridResult.cells.map(cell => {
      const hs = cell.size / 2;
      return {
        polygon: [
          [cell.cx - hs, cell.cy - hs, 0],
          [cell.cx + hs, cell.cy - hs, 0],
          [cell.cx + hs, cell.cy + hs, 0],
          [cell.cx - hs, cell.cy + hs, 0]
        ],
        elevation: cell.elevation,
        color: getHeightColor(cell.elevation)
      };
    });
  }, [gridResult]);

  // 3. Map detected objects to PolygonLayer polygons
  const objectData = useMemo(() => {
    return frame.detected_objects.map(obj => {
      // Create a bounding box polygon (ignoring rotation for simplicity in basic bounding box, 
      // or we can calculate rotated corners if needed. Since it's deck.gl PolygonLayer, 
      // we can do simple unrotated boxes or manually rotate the 4 corners).
      const [ox, oy] = obj.position;
      const hw = obj.size[0] / 2;
      const hl = obj.size[1] / 2;
      const h = obj.heading;

      // Rotate corners around (ox, oy)
      const cosH = Math.cos(-h);
      const sinH = Math.sin(-h);

      const rotate = (x: number, y: number) => [
        ox + (x * cosH - y * sinH),
        oy + (x * sinH + y * cosH),
        0
      ];

      return {
        polygon: [
          rotate(-hw, -hl),
          rotate(hw, -hl),
          rotate(hw, hl),
          rotate(-hw, hl)
        ],
        elevation: obj.size[2] || 1.5,
        color: hexToRgb(OBJ_TYPE_COLORS[obj.type] ?? '#cccccc')
      };
    });
  }, [frame]);

  const layers = [
    new PolygonLayer({
      id: 'terrain-blocks',
      data: terrainData,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: true,
      wireframe: true,
      lineWidthMinPixels: 1,
      getPolygon: (d: any) => d.polygon,
      getElevation: (d: any) => Math.max(d.elevation, 0.01), // extrude slightly even if 0
      getFillColor: (d: any) => d.color,
      getLineColor: [255, 255, 255, 40], // Faint white wireframe
      material: {
        ambient: 0.5,
        diffuse: 0.8,
        shininess: 32,
        specularColor: [255, 255, 255]
      }
    }),
    new PolygonLayer({
      id: 'detected-objects',
      data: objectData,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: true,
      wireframe: true,
      lineWidthMinPixels: 2,
      getPolygon: (d: any) => d.polygon,
      getElevation: (d: any) => d.elevation,
      getFillColor: (d: any) => {
        const c = d.color;
        return [c[0], c[1], c[2], 180]; // Semi-transparent objects
      },
      getLineColor: (d: any) => d.color
    })
  ];

  const INITIAL_VIEW_STATE = useMemo(() => ({
    target: [egoX, egoY, 0] as [number, number, number],
    rotationX: 60,
    rotationOrbit: -90,
    zoom: 2
  }), []); // empty deps so it doesn't reset when ego moves!

  const orbitView = useMemo(() => new OrbitView({ id: 'orbit-view' }), []);

  return (
    <DeckGL
      views={orbitView}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={layers}
      effects={[lightingEffect]}
      style={{ background: 'transparent' }}
    />
  );
}
