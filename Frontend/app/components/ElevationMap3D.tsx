'use client';

import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { PolygonLayer } from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { DemoData } from '../types/dataset';
import { buildFoveatedGrid } from '../lib/foveatedGrid';
import type { FrameData } from '../lib/binaryProtocol';

const INITIAL_VIEW_STATE = {
  longitude: 0,
  latitude: 0,
  zoom: 18,
  pitch: 60,
  bearing: 0
};

// Convert meters to approx degrees at equator (for deck.gl)
const M_TO_DEG = 1 / 111320;

// Color gradient for elevation (blue -> green -> yellow -> red)
function getElevationColor(z: number): [number, number, number, number] {
  if (z < 0) return [40, 40, 150, 255];
  if (z < 1) return [40, 150, 80, 255];
  if (z < 3) return [200, 200, 50, 255];
  return [220, 50, 50, 255];
}

interface Props {
  data: DemoData;
  frameIdxRef: React.RefObject<number>;
  mode: 'simulated' | 'live';
  liveFrame: FrameData | null;
}

export default function ElevationMap3D({ data, frameIdxRef, mode, liveFrame }: Props) {
  const fi = frameIdxRef.current ?? 0;

  const layers = useMemo(() => {
    if (mode === 'simulated') {
      const frame = data.frames[fi];
      if (!frame) return [];
      
      const gridResult = buildFoveatedGrid(data.static_environment.lidar_points, frame.vehicle.position[0], frame.vehicle.position[1]);

      const cellLayer = new PolygonLayer({
        id: 'elevation-cells',
        data: gridResult.cells,
        getPolygon: d => {
          const hs = d.size / 2 * M_TO_DEG;
          const cx = d.cx * M_TO_DEG;
          const cy = d.cy * M_TO_DEG;
          return [
            [cx - hs, cy - hs],
            [cx + hs, cy - hs],
            [cx + hs, cy + hs],
            [cx - hs, cy + hs]
          ];
        },
        getFillColor: d => getElevationColor(d.elevation),
        getElevation: d => Math.max(0.1, d.elevation),
        extruded: true,
        wireframe: false,
        pickable: true
      });

      const objLayer = new PolygonLayer({
        id: 'detected-objects',
        data: frame.detected_objects,
        getPolygon: d => {
          const l = (d.size[0] / 2) * M_TO_DEG;
          const w = (d.size[1] / 2) * M_TO_DEG;
          const cx = d.position[0] * M_TO_DEG;
          const cy = d.position[1] * M_TO_DEG;
          const cos = Math.cos(d.heading);
          const sin = Math.sin(d.heading);
          
          const rot = (x: number, y: number) => [
            cx + x * cos - y * sin,
            cy + x * sin + y * cos
          ];

          return [
            rot(-l, -w),
            rot(l, -w),
            rot(l, w),
            rot(-l, w)
          ];
        },
        getFillColor: [255, 100, 100, 200],
        getElevation: d => d.size[2] || 1.5,
        extruded: true,
        wireframe: true
      });

      return [cellLayer, objLayer];
      
    } else {
      if (!liveFrame) return [];

      // We need to convert SoA arrays to an array of objects for deck.gl, or use a custom layer.
      // For simplicity, we convert to array of objects.
      const cellCount = liveFrame.cell_x.length;
      const cellsData = new Array(cellCount);
      for(let i=0; i<cellCount; i++) {
          cellsData[i] = {
              x: liveFrame.cell_x[i],
              y: liveFrame.cell_y[i],
              res: liveFrame.cell_resolution[i],
              elev: liveFrame.cell_ground_elev[i] + liveFrame.cell_object_height[i]
          };
      }

      const cellLayer = new PolygonLayer({
        id: 'elevation-cells-live',
        data: cellsData,
        getPolygon: d => {
          const hs = d.res / 2 * M_TO_DEG;
          // Apply ego transform if needed, but if we keep it local:
          const cx = (d.x + liveFrame.ego_x) * M_TO_DEG;
          const cy = (d.y + liveFrame.ego_y) * M_TO_DEG;
          return [
            [cx - hs, cy - hs],
            [cx + hs, cy - hs],
            [cx + hs, cy + hs],
            [cx - hs, cy + hs]
          ];
        },
        getFillColor: d => getElevationColor(d.elev),
        getElevation: d => Math.max(0.1, d.elev),
        extruded: true,
        wireframe: false,
      });
      
      const objData = [];
      if (liveFrame.obj_id) {
          for(let i=0; i<liveFrame.obj_id.length; i++){
              objData.push({
                  x: liveFrame.obj_cx![i] + liveFrame.ego_x,
                  y: liveFrame.obj_cy![i] + liveFrame.ego_y,
                  l: liveFrame.obj_l![i],
                  w: liveFrame.obj_w![i],
                  h: liveFrame.obj_h![i],
                  heading: liveFrame.obj_heading![i]
              });
          }
      }

      const objLayer = new PolygonLayer({
        id: 'detected-objects-live',
        data: objData,
        getPolygon: d => {
          const l = (d.l / 2) * M_TO_DEG;
          const w = (d.w / 2) * M_TO_DEG;
          const cx = d.x * M_TO_DEG;
          const cy = d.y * M_TO_DEG;
          const cos = Math.cos(d.heading);
          const sin = Math.sin(d.heading);
          
          const rot = (x: number, y: number) => [
            cx + x * cos - y * sin,
            cy + x * sin + y * cos
          ];

          return [
            rot(-l, -w),
            rot(l, -w),
            rot(l, w),
            rot(-l, w)
          ];
        },
        getFillColor: [255, 100, 100, 200],
        getElevation: d => d.h,
        extruded: true,
        wireframe: true
      });

      return [cellLayer, objLayer];
    }
  }, [fi, mode, liveFrame, data]);

  const viewState = useMemo(() => {
     let center = [0,0];
     if (mode === 'simulated' && data.frames[fi]) {
         center = [data.frames[fi].vehicle.position[0] * M_TO_DEG, data.frames[fi].vehicle.position[1] * M_TO_DEG];
     } else if (liveFrame) {
         center = [liveFrame.ego_x * M_TO_DEG, liveFrame.ego_y * M_TO_DEG];
     }
     return {
         ...INITIAL_VIEW_STATE,
         longitude: center[0],
         latitude: center[1]
     };
  }, [fi, mode, liveFrame, data]);


  return (
    <div className="absolute inset-0" onContextMenu={e => e.preventDefault()}>
      <DeckGL
        initialViewState={viewState}
        controller={true}
        layers={layers}
      >
        <Map
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json"
        />
      </DeckGL>
    </div>
  );
}
