'use client';

import { useEffect, useRef, useState } from 'react';
import type { DemoData } from '../types/dataset';
import { getObjColor } from '../lib/foveatedGrid';
import AccuracyChart from './AccuracyChart';

interface Props { data: DemoData; frameIdx: number }

export default function ElevationSlice({ data, frameIdx }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDark, setIsDark] = useState(true);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });


  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    update();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheelNative = (e: WheelEvent) => {
      // only zoom if we are in the slice tab
      // since tab is state, we need to access it via a ref or just rely on the fact that 
      // AccuracyChart doesn't have the wheel listener attached. Wait, the listener is on the container canvas!
      // To keep it simple, we just prevent default on wheel if they scroll the canvas.
      e.preventDefault();
      const zoomSensitivity = 0.001;
      setZoom(z => Math.max(0.5, Math.min(10, z - e.deltaY * zoomSensitivity)));
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


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, width, height);

    ctx.translate(offset.x + (width / 2) * (1 - zoom), offset.y + (height / 2) * (1 - zoom));
    ctx.scale(zoom, zoom);
    const margin = { top: 20, right: 60, bottom: 30, left: 40 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const latTicks = [-40, -20, 0, 20, 40];
    latTicks.forEach((tick) => {
      const x = margin.left + ((tick + 40) / 80) * plotW;
      ctx.moveTo(x, margin.top); ctx.lineTo(x, margin.top + plotH);
    });
    const htTicks = [-4, -2, 0, 2, 4];
    htTicks.forEach((tick) => {
      const y = margin.top + plotH - ((tick + 4) / 8) * plotH;
      ctx.moveTo(margin.left, y); ctx.lineTo(margin.left + plotW, y);
    });
    ctx.stroke();

    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'; ctx.lineWidth = 1; ctx.beginPath();
    const midY = margin.top + plotH - ((0 + 4) / 8) * plotH;
    ctx.moveTo(margin.left, midY); ctx.lineTo(margin.left + plotW, midY);
    const midX = margin.left + ((0 + 40) / 80) * plotW;
    ctx.moveTo(midX, margin.top); ctx.lineTo(midX, margin.top + plotH);
    ctx.stroke();

    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'; ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    latTicks.forEach((tick) => {
      const x = margin.left + ((tick + 40) / 80) * plotW;
      ctx.fillText(tick + 'm', x, margin.top + plotH + 5);
    });
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    htTicks.forEach((tick) => {
      const y = margin.top + plotH - ((tick + 4) / 8) * plotH;
      ctx.fillText(tick + 'm', margin.left - 5, y);
    });

    const frame = data.frames[frameIdx];
    const carX = frame.vehicle.position[0];
    const points = data.static_environment.lidar_points;
    const sliceWidth = 2.0;
    let potholeFound = false; let potholeX = 0; let potholeY = 0;

    const slicePoints = [];
    const bins = new Map<number, number>();
    const BIN_SIZE = 0.5;

    for (const p of points) {
      if (Math.abs(p.position[0] - carX) > sliceWidth) continue;
      slicePoints.push(p);
      const py = p.position[1];
      const pz = p.position[2];
      const binIdx = Math.floor(py / BIN_SIZE);
      if (!bins.has(binIdx) || pz > bins.get(binIdx)!) {
        bins.set(binIdx, pz);
      }
    }

    // 1. Draw silhouette (mountain)
    const sortedBins = Array.from(bins.keys()).sort((a, b) => a - b);
    if (sortedBins.length > 0) {
      ctx.fillStyle = 'rgba(35, 70, 120, 0.35)'; // Semi-transparent blue mountain base
      ctx.beginPath();
      const firstY = sortedBins[0] * BIN_SIZE;
      const firstDrawX = margin.left + ((firstY + 40) / 80) * plotW;
      const groundY = margin.top + plotH; // bottom of the plot
      ctx.moveTo(firstDrawX, groundY);

      for (const b of sortedBins) {
        const y = b * BIN_SIZE + BIN_SIZE / 2;
        const z = bins.get(b)!;
        const drawX = margin.left + ((y + 40) / 80) * plotW;
        const drawY = margin.top + plotH - ((z + 4) / 8) * plotH;
        ctx.lineTo(drawX, drawY);
      }

      const lastY = sortedBins[sortedBins.length - 1] * BIN_SIZE;
      const lastDrawX = margin.left + ((lastY + 40) / 80) * plotW;
      ctx.lineTo(lastDrawX, groundY);
      ctx.fill();
    }

    // 2. Draw points on top
    for (const p of slicePoints) {
      const py = p.position[1]; const pz = p.position[2];
      const drawX = margin.left + ((py + 40) / 80) * plotW;
      const drawY = margin.top + plotH - ((pz + 4) / 8) * plotH;
      const t = Math.max(0, Math.min(1, (pz + 1) / 4));
      const r = Math.floor(Math.max(0, 2 * t - 1) * 255);
      const g = Math.floor((1 - 2 * Math.abs(t - 0.5)) * 255);
      const b = Math.floor(Math.max(0, 1 - 2 * t) * 255);
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fillRect(drawX, drawY, 2, 2);
      if (p.classification === 'pothole') { potholeFound = true; potholeX = drawX; potholeY = drawY; }
    }

    // Detected objects cross-sections
    for (const obj of frame.detected_objects) {
      const ox = obj.position[0];
      if (Math.abs(ox - carX) > sliceWidth + obj.size[0] / 2) continue;
      const oy = obj.position[1];
      const oz = obj.position[2] + (obj.size[2] || 1.5) / 2;
      const drawX = margin.left + ((oy + 40) / 80) * plotW;
      const drawY = margin.top + plotH - ((oz + 4) / 8) * plotH;
      const boxW = (obj.size[1] / 80) * plotW;
      const boxH = ((obj.size[2] || 1.5) / 8) * plotH;
      const color = getObjColor(obj.type);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.strokeRect(drawX - boxW / 2, drawY - boxH / 2, boxW, boxH);
      ctx.fillStyle = color; ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(obj.type, drawX, drawY - boxH / 2 - 2);
    }

    // Ego vehicle box
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'; ctx.lineWidth = 1.5;
    const carW = (2 / 80) * plotW; const carH = (1.5 / 8) * plotH;
    const carDrawY = margin.top + plotH - ((-1.5 + 4) / 8) * plotH;
    ctx.strokeRect(midX - carW / 2, carDrawY - carH / 2, carW, carH);

    if (potholeFound) {
      ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 1;
      ctx.strokeRect(potholeX - 10, potholeY - 10, 20, 20);
      ctx.fillStyle = '#ff3333'; ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('pothole', potholeX, potholeY + 12);
    }

    // Height gradient legend
    const legX = width - 30; const legY = margin.top + 10;
    const legH = plotH - 20;
    const gradient = ctx.createLinearGradient(0, legY, 0, legY + legH);
    gradient.addColorStop(0, 'rgb(255,0,0)'); gradient.addColorStop(0.25, 'rgb(255,255,0)');
    gradient.addColorStop(0.5, 'rgb(0,255,0)'); gradient.addColorStop(0.75, 'rgb(0,255,255)');
    gradient.addColorStop(1, 'rgb(0,0,255)');
    ctx.fillStyle = gradient; ctx.fillRect(legX, legY, 10, legH);
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'; ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    [3.0, 1.5, 0.0, -1.5, -3.0].forEach((tick, i) => {
      ctx.fillText(tick.toFixed(1), legX + 13, legY + (i / 4) * legH);
    });
  }, [data, frameIdx, zoom, offset, isDark]);

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-3">
      <div className="flex-1 relative rounded-md overflow-hidden bg-background">
        <canvas ref={canvasRef} className="w-full h-full block" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} />
      </div>
      <div className="flex-1 relative rounded-md overflow-hidden bg-background">
        <AccuracyChart data={data} />
      </div>
    </div>
  );
}
