'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import type { DemoData, Frame } from '../types/dataset';
import {
  buildFoveatedGrid,
  getSemanticColor,
  getObjColor,
  getObjectClass,
  zoneAlpha,
} from '../lib/foveatedGrid';
import { Plus, Minus } from 'lucide-react';

interface Props {
  data: DemoData;
  frameIdx: number;
}

export default function SemanticMap2D({ data, frameIdx }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // Pinch-to-zoom or Ctrl+Wheel
        const zoomSensitivity = 0.01;
        setZoom(z => Math.max(0.5, Math.min(10, z - e.deltaY * zoomSensitivity)));
      } else {
        // Two-finger scroll (pan)
        setOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
    };
    canvas.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheelNative);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const frame = data.frames[frameIdx];
  const egoX = frame.vehicle.position[0];
  const egoY = frame.vehicle.position[1];

  const gridResult = useMemo(
    () => buildFoveatedGrid(data.static_environment.lidar_points, egoX, egoY),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, frameIdx],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Background (Light theme --color-9 equivalent: #F8F9FA)
    ctx.fillStyle = '#F8F9FA';
    ctx.fillRect(0, 0, width, height);

    // Plot margins for axes
    const margin = { top: 40, right: 20, bottom: 40, left: 50 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    // Draw Plot Border
    ctx.strokeStyle = '#343A40'; // --color-2
    ctx.lineWidth = 1;
    ctx.strokeRect(margin.left, margin.top, plotW, plotH);

    // Title
    ctx.fillStyle = '#212529'; // --color-1
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Adaptive Variable-Resolution 2.5D LiDAR Map', width / 2, margin.top - 10);

    // X Axis Label
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('X (meters)', margin.left + plotW / 2, margin.top + plotH + 25);

    // Y Axis Label
    ctx.save();
    ctx.translate(margin.left - 35, margin.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'bottom';
    ctx.fillText('Y (meters)', 0, 0);
    ctx.restore();

    // Scale calculation (1:1 aspect ratio mapping)
    const viewXSpan = 110; // Zoomed in closer by default
    let scale = plotW / viewXSpan;
    scale *= zoom;

    const viewYSpan = plotH / scale; // what fits vertically

    // Center of map is ego position. Wait, the image shows X from -100 to 100, Y from -20 to 20.
    // If we put ego at (0,0) in the view:
    const cx = margin.left + plotW / 2 + offset.x;
    const cy = margin.top + plotH / 2 + offset.y;

    // Grid Lines & Ticks
    ctx.strokeStyle = '#DEE2E6'; // --color-7 light grid
    ctx.lineWidth = 1;
    ctx.fillStyle = '#495057'; // --color-3 text
    ctx.font = '10px sans-serif';

    // X Ticks every 25m
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = -200; x <= 200; x += 25) {
      const px = cx + x * scale;
      if (px >= margin.left && px <= margin.left + plotW) {
        ctx.beginPath();
        ctx.moveTo(px, margin.top);
        ctx.lineTo(px, margin.top + plotH);
        ctx.stroke();
        ctx.fillText(x.toString(), px, margin.top + plotH + 5);
      }
    }

    // Y Ticks every 10m
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = -200; y <= 200; y += 10) {
      // In cartesian, Y goes UP. But canvas Y goes DOWN. So we subtract y*scale
      const py = cy - y * scale;
      if (py >= margin.top && py <= margin.top + plotH) {
        ctx.beginPath();
        ctx.moveTo(margin.left, py);
        ctx.lineTo(margin.left + plotW, py);
        ctx.stroke();
        ctx.fillText(y.toString(), margin.left - 5, py);
      }
    }

    // Clip to plot area for drawing data
    ctx.save();
    ctx.beginPath();
    ctx.rect(margin.left, margin.top, plotW, plotH);
    ctx.clip();

    // Move to plot coordinate system
    ctx.translate(cx, cy);

    // -- 1. Zone rings ----------------------------------------------------------
    for (const r of [5, 20, 40]) {
      ctx.beginPath();
      ctx.arc(0, 0, r * scale, 0, Math.PI * 2);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#212529'; // dark dashed rings
      ctx.lineWidth = 1.0;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // -- 2. Draw projected grid cells ------------------------------------------
    for (const cell of gridResult.cells) {
      const ox = cell.cx - egoX;
      const oy = cell.cy - egoY;

      // cdx = ox * scale, cdy = -oy * scale (Cartesian Y is up)
      const px = ox * scale;
      const py = -oy * scale;

      // Check if it's visible in plot roughly
      if (px < -plotW / 2 - 50 || px > plotW / 2 + 50 || py < -plotH / 2 - 50 || py > plotH / 2 + 50) continue;

      const alpha = zoneAlpha(cell.zone);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = getSemanticColor(cell.semantic);
      const s = cell.size * scale;
      ctx.fillRect(px - s / 2, py - s / 2, s, s);

      ctx.globalAlpha = Math.min(1.0, alpha + 0.2);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; // faint white border around cells for definition
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px - s / 2, py - s / 2, s, s);
    }

    // -- 3. Draw detected objects with STATIC / DYNAMIC classification ----------
    ctx.globalAlpha = 1.0;
    for (const obj of frame.detected_objects) {
      const ox = obj.position[0] - egoX;
      const oy = obj.position[1] - egoY;
      const px = ox * scale;
      const py = -oy * scale; // Y is up

      if (px < -plotW / 2 - 50 || px > plotW / 2 + 50 || py < -plotH / 2 - 50 || py > plotH / 2 + 50) continue;

      const color = getObjColor(obj.type);
      const objClass = getObjectClass(obj.type); // 'static' | 'dynamic' | 'unknown'
      const opacity = 0.5 + obj.confidence * 0.5;

      const sX = obj.size[0] * scale;
      const sY = obj.size[1] * scale;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(obj.heading); // rotate by heading (flipped y may affect angle dir, wait, usually angle is from X axis)

      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = objClass === 'dynamic' ? 2 : 1.5;

      if (objClass === 'static') ctx.setLineDash([2, 2]);
      else ctx.setLineDash([]);

      ctx.strokeRect(-sX / 2, -sY / 2, sX, sY);
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity * 0.4;
      ctx.fillRect(-sX / 2, -sY / 2, sX, sY);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // -- 4. Ego vehicle (Bullseye instead of X) ----------------------------------------
    ctx.globalAlpha = 1.0;
    ctx.save();
    ctx.fillStyle = '#0056b3'; // dark blue
    ctx.strokeStyle = '#0056b3';
    ctx.lineWidth = 2;

    // Outer circle
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.restore(); // restore plot area clipping

    // Draw Legend embedded in the canvas (as shown in the reference image)
    const legW = 60;
    const legH = 22;
    const legX = width / 2 - legW / 2;
    const legY = margin.top + plotH - legH - 10;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#CED4DA'; // --color-6
    ctx.lineWidth = 1;
    ctx.fillRect(legX, legY, legW, legH);
    ctx.strokeRect(legX, legY, legW, legH);

    ctx.strokeStyle = '#0056b3';
    ctx.fillStyle = '#0056b3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(legX + 12, legY + legH / 2, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(legX + 12, legY + legH / 2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#212529';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('LiDAR', legX + 22, legY + legH / 2 + 1);

  }, [data, frameIdx, gridResult, frame, egoX, egoY, zoom, offset]);

  return (
    <div className="relative w-full h-full">
      <canvas
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        ref={canvasRef}
        className="w-full h-full block cursor-move"
      />
      <div className="absolute bottom-4 right-4 flex flex-col bg-card/70 backdrop-blur-md border border-border shadow-sm rounded-md overflow-hidden">
        <button onClick={() => setZoom(z => Math.min(10, z * 1.2))} className="p-2 border-b border-border hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors cursor-pointer flex items-center justify-center" aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button onClick={() => setZoom(z => Math.max(0.5, z / 1.2))} className="p-2 hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors cursor-pointer flex items-center justify-center" aria-label="Zoom out">
          <Minus size={16} />
        </button>
      </div>
    </div>
  );
}
