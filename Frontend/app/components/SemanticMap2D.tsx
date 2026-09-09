'use client';

import { useEffect, useRef, useMemo } from 'react';
import type { DemoData } from '../types/dataset';
import { buildFoveatedGrid, SEMANTIC_COLORS_HEX } from '../lib/foveatedGrid';
import type { FrameData } from '../lib/binaryProtocol';

const BACKEND_CLASS_NAMES: Record<number, string> = {
  0: "unlabeled", 1: "car", 2: "bicycle", 3: "motorcycle", 4: "truck", 5: "other-vehicle",
  6: "person", 7: "bicyclist", 8: "motorcyclist", 9: "road", 10: "parking", 11: "sidewalk",
  12: "other-ground", 13: "building", 14: "fence", 15: "vegetation", 16: "trunk", 17: "terrain",
  18: "pole", 19: "traffic-sign"
};

interface Props {
  data: DemoData;
  frameIdx: number;
  mode: 'simulated' | 'live';
  liveFrame: FrameData | null;
}

export default function SemanticMap2D({ data, frameIdx, mode, liveFrame }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const gridResult = useMemo(() => {
    if (mode === 'live') return null;
    const vp = data.frames[frameIdx].vehicle.position;
    return buildFoveatedGrid(data.static_environment.lidar_points, vp[0], vp[1]);
  }, [data, frameIdx, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Dynamically resize canvas to match its parent container to fill full width
    const parent = canvas.parentElement;
    if (parent) {
      if (canvas.width !== parent.clientWidth) canvas.width = parent.clientWidth;
      if (canvas.height !== parent.clientHeight) canvas.height = parent.clientHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We want the viewport to cover a smaller, zoomed-in area centered around the ego vehicle.
    const VIEW_SIZE = 60; 
    const w = canvas.width;
    const h = canvas.height;
    
    // Auto-scale to fill canvas
    const scale = Math.min(w, h) / VIEW_SIZE;
    
    // Clear
    ctx.clearRect(0, 0, w, h);
    
    // Draw background grid lines
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<w; i+= scale * 10) {
        ctx.moveTo(i, 0); ctx.lineTo(i, h);
        ctx.moveTo(0, i); ctx.lineTo(w, i);
    }
    ctx.stroke();

    ctx.save();
    // Center ego at the exact center of the map
    ctx.translate(w / 2, h / 2);

    if (mode === 'simulated' && gridResult) {
        const vp = data.frames[frameIdx].vehicle.position;
        const egoX = vp[0];
        const egoY = vp[1];

        // Draw cells with distinct sizes per resolution band
        gridResult.cells.forEach(cell => {
          const dx = (cell.cx - egoX) * scale;
          const dy = (cell.cy - egoY) * scale;
          // Ensure near 5cm cells remain crisp and visible, while mid and far show their true scale
          const s = Math.max(cell.zone === 'near' ? 1.5 : 3.0, cell.size * scale);
          
          ctx.fillStyle = SEMANTIC_COLORS_HEX[cell.semantic] || '#555';
          ctx.fillRect(dx - s / 2, dy - s / 2, s, s);

          // Render crisp grid boundaries on mid and far cells to visually distinguish adaptive resolution
          if (cell.zone === 'far' || cell.zone === 'mid') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = cell.zone === 'far' ? 1.5 : 0.8;
            ctx.strokeRect(dx - s / 2, dy - s / 2, s, s);
          }
        });

        // Draw detected objects
        data.frames[frameIdx].detected_objects.forEach(obj => {
          const dx = (obj.position[0] - egoX) * scale;
          const dy = (obj.position[1] - egoY) * scale;
          const [l, w_obj] = obj.size;
          
          ctx.save();
          ctx.translate(dx, dy);
          ctx.rotate(obj.heading);
          
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(- (l/2)*scale, - (w_obj/2)*scale, l*scale, w_obj*scale);
          
          ctx.restore();
        });

    } else if (mode === 'live' && liveFrame) {
        const { cell_x, cell_y, cell_resolution, cell_semantic_id } = liveFrame;
        
        for (let i = 0; i < cell_x.length; i++) {
            const cx = cell_x[i] * scale;
            const cy = -cell_y[i] * scale; // invert Y for canvas
            const res = cell_resolution[i];
            const s = res * scale;
            
            const cls = BACKEND_CLASS_NAMES[cell_semantic_id[i]] || 'unlabeled';
            ctx.fillStyle = SEMANTIC_COLORS_HEX[cls] || '#555';
            
            // Draw filled cell (minimum pixel size so 5cm cells are visible to human eye)
            const minRenderSize = Math.max(s, 1.5);
            ctx.fillRect(cx - minRenderSize/2, cy - minRenderSize/2, minRenderSize, minRenderSize);

            // Draw crisp boundaries for mid/far cells to highlight adaptive compression
            if (res > 0.051) {
              ctx.strokeStyle = res >= 0.25 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.2)';
              ctx.lineWidth = res >= 0.25 ? 1.5 : 0.8;
              const borderSize = Math.max(s, 2.0);
              ctx.strokeRect(cx - borderSize/2, cy - borderSize/2, borderSize, borderSize);
            }
        }

        // Draw Live Objects
        if (liveFrame.obj_id) {
            for (let i = 0; i < liveFrame.obj_id.length; i++) {
                const cx = liveFrame.obj_cx![i] * scale;
                const cy = -liveFrame.obj_cy![i] * scale;
                const l = liveFrame.obj_l![i] * scale;
                const w_obj = liveFrame.obj_w![i] * scale;
                const heading = liveFrame.obj_heading![i];
                
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(heading);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(-l/2, -w_obj/2, l, w_obj);
                ctx.restore();
            }
        }
    }

    // Draw Ego Vehicle marker with heading orientation
    ctx.save();
    ctx.fillStyle = '#00e5ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    const egoCarW = 2.0 * scale;
    const egoCarL = 4.5 * scale;
    ctx.beginPath();
    ctx.roundRect(-egoCarL / 2, -egoCarW / 2, egoCarL, egoCarW, 2);
    ctx.fill();
    ctx.stroke();
    // Forward direction pointer
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(egoCarL / 2 + 2, 0);
    ctx.lineTo(egoCarL / 2 - 3, -2.5);
    ctx.lineTo(egoCarL / 2 - 3, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    // Draw adaptive range rings (10m Near, 30m Mid, 100m Far)
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // 10m Ring (Near boundary - 5cm)
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(0, 0, 10 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // 30m Ring (Mid boundary - 50cm)
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, 30 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // 100m Ring (Far boundary - 100cm)
    ctx.strokeStyle = 'rgba(255, 68, 68, 0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, 100 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Range ring labels
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0, 229, 255, 0.8)';
    ctx.fillText('10m (5cm)', 10 * scale + 3, -4);
    ctx.fillStyle = 'rgba(255, 170, 0, 0.8)';
    ctx.fillText('30m (50cm)', 30 * scale + 3, -4);
    ctx.fillStyle = 'rgba(255, 68, 68, 0.7)';
    ctx.fillText('100m (1m)', 100 * scale + 3, -4);

    ctx.restore();
  }, [gridResult, mode, liveFrame, frameIdx, data]);

  return (
    <div className="w-full h-full overflow-hidden flex items-center justify-center">
      <canvas 
        ref={canvasRef}
        className="block"
      />
    </div>
  );
}
