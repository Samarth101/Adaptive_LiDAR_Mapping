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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We want the viewport to cover ~[-60, +120] in X and [-60, +60] in Y relative to the ego.
    // The canvas is e.g. 800x800 -> let's map a 120x120m area
    const VIEW_SIZE = 120; 
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
    // Center ego at middle-left (since LiDAR often looks forward X)
    ctx.translate(w / 4, h / 2);

    if (mode === 'simulated' && gridResult) {
        const vp = data.frames[frameIdx].vehicle.position;
        const egoX = vp[0];
        const egoY = vp[1];

        // Draw cells
        gridResult.cells.forEach(cell => {
          const dx = (cell.cx - egoX) * scale;
          const dy = (cell.cy - egoY) * scale;
          const s = cell.size * scale;
          
          ctx.fillStyle = SEMANTIC_COLORS_HEX[cell.semantic] || '#555';
          ctx.fillRect(dx - s/2, dy - s/2, s, s);
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
            // Points are already relative to ego if we don't add ego_x, but let's check
            // Actually they are in local space (lidar frame). X is forward, Y is left.
            // On canvas, let X be right, Y be down.
            const cx = cell_x[i] * scale;
            const cy = -cell_y[i] * scale; // invert Y for canvas
            const s = cell_resolution[i] * scale;
            
            const cls = BACKEND_CLASS_NAMES[cell_semantic_id[i]] || 'unlabeled';
            ctx.fillStyle = SEMANTIC_COLORS_HEX[cls] || '#555';
            
            // For live data, draw cells as slightly padded boxes to hide seams
            ctx.fillRect(cx - s/2, cy - s/2, s+0.5, s+0.5);
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

    // Draw Ego Vehicle marker
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw rings
    ctx.strokeStyle = '#ff000055';
    ctx.beginPath(); ctx.arc(0, 0, 10 * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 30 * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 60 * scale, 0, Math.PI * 2); ctx.stroke();

    ctx.restore();
  }, [gridResult, mode, liveFrame, frameIdx, data]);

  return (
    <canvas 
      ref={canvasRef}
      width={800}
      height={800}
      className="w-full h-full object-contain"
    />
  );
}
