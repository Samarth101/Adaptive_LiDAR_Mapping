'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { DemoData, Frame } from '../types/dataset';
import { buildFoveatedGrid } from '../lib/foveatedGrid';
import dynamic from 'next/dynamic';
import MetricsHUD from './MetricsHUD';
import MemorySavingsHUD from './MemorySavingsHUD';
import SemanticLegend from './SemanticLegend';
import { Button, buttonVariants } from '@/components/ui/button';
import InteractiveDotPattern from './InteractiveDotPattern';
import { Play, Pause, Moon, Sun, GitBranch } from 'lucide-react';
import Image from 'next/image';

// Dynamic imports (WebGL / canvas — client only)
const LidarScene = dynamic(() => import('./LidarScene'), { ssr: false });
const SemanticMap2D = dynamic(() => import('./SemanticMap2D'), { ssr: false });
const ElevationMap3D = dynamic(() => import('./ElevationMap3D'), { ssr: false });
const ElevationSlice = dynamic(() => import('./ElevationSlice'), { ssr: false });

interface Props {
  onFrameChange: (frame: Frame) => void;
}

export default function LidarViewer({ onFrameChange }: Props) {
  const [data, setData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(0);
  const [isDark, setIsDark] = useState(true);

  const frameIdxRef = useRef(0);
  const lastFpsTime = useRef(performance.now());
  const fpsFrameCount = useRef(0);

  useEffect(() => {
    // Check initial theme
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  // FPS counter (ticks on animation frame, lightweight)
  useEffect(() => {
    let raf: number;
    const tick = () => {
      fpsFrameCount.current++;
      const now = performance.now();
      const elapsed = now - lastFpsTime.current;
      if (elapsed >= 500) {
        setFps(Math.round((fpsFrameCount.current / elapsed) * 1000));
        fpsFrameCount.current = 0;
        lastFpsTime.current = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    frameIdxRef.current = frameIdx;
  }, [frameIdx]);

  useEffect(() => {
    fetch('/data/autonomous_driving_demo_data.json')
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() as Promise<DemoData>; })
      .then((json) => { setData(json); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    if (data) onFrameChange(data.frames[frameIdx]);
  }, [data, frameIdx, onFrameChange]);

  useEffect(() => {
    if (!playing || !data) return;
    const id = setInterval(() => setFrameIdx((i) => (i + 1) % data.frames.length), 500);
    return () => clearInterval(id);
  }, [playing, data]);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  // Compute grid result centrally to share with HUDs
  const gridResult = useMemo(() => {
    if (!data) return null;
    const frame = data.frames[frameIdx];
    const egoX = frame.vehicle.position[0];
    const egoY = frame.vehicle.position[1];
    return buildFoveatedGrid(data.static_environment.lidar_points, egoX, egoY);
  }, [data, frameIdx]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <div className="w-9 h-9 border-2 border-border border-t-primary rounded-full animate-spin" />
        <p>Loading</p>
      </div>
    );
  }
  if (error || !data || !gridResult) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p>Failed to load</p>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const frame = data.frames[frameIdx];

  return (
    <div className="w-screen bg-transparent text-foreground overflow-y-auto overflow-x-hidden min-h-screen pb-12 relative">
      <InteractiveDotPattern />

      {/* Header */}
      <div className="fixed top-3 left-3 w-fit bg-card/30 backdrop-blur-xs px-6 py-3 rounded-full z-50 border flex items-center justify-center">
        <Image src="/logo.png" alt="Data Exploiters Logo" width={150} height={32} className="h-6 w-auto dark:invert" />
      </div>
      <div className="fixed top-3 right-3 w-fit bg-card/30 backdrop-blur-xs px-3 py-2 rounded-full flex items-center gap-3 z-50 border">
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className='mx-1 rounded-full'
        >
          <Image src="/github.svg" alt="GitHub" width={24} height={24} className="dark:invert opacity-80 hover:opacity-100 transition-opacity" />
        </a>
        <button
          onClick={toggleTheme}
          className="relative flex gap-2 w-fit h-fit rounded-full bg-muted transition-colors p-2 cursor-pointer"
          aria-label="Toggle Theme"
        >
          <Sun className="w-4 h-4 text-zinc-400 dark:text-zinc-600" />
          <Moon className="w-4 h-4 text-zinc-400 dark:text-zinc-600" />
          <div
            className={`absolute left-1.25 top-1.25 w-5.5 h-5.5 rounded-full bg-zinc-900 dark:bg-white shadow-sm transition-transform duration-300 ease-in-out flex items-center justify-center ${isDark ? 'translate-x-6' : 'translate-x-0'
              }`}
          />
        </button>
        <Button
          onClick={togglePlay}
          variant='default'
          className={"rounded-full px-3"}
        >
          {playing ? 'Pause' : 'Play'}
        </Button>
      </div>

      {/* Main Content */}
      <div className="mt-20 p-6 space-y-8 max-w-340 mx-auto">

        {/* Metrics Section */}
        <div className="w-full max-w-6xl mx-auto relative">
          <div className="w-[calc(100%-64px)] h-10 bg-muted-foreground/70 backdrop-blur-lg rounded-full absolute -top-3 left-8 z-1" />
          <div className="relative flex items-center gap-4 bg-card/70 backdrop-blur-lg z-10 rounded-full border border-border px-8 py-3">
            <div className="min-w-30 grow">
              <div className="text-muted-foreground mb-1 text-xs">FPS</div>
              <div className="text-lg">{fps}</div>
            </div>
            <div className="h-14 w-px bg-border"></div>
            <div className="min-w-30 grow">
              <div className="text-muted-foreground mb-1 text-xs">Frame</div>
              <div className="text-lg">{frame.frame_id}</div>
            </div>
            <div className="h-14 w-px bg-border"></div>
            <div className="min-w-30 grow">
              <div className="text-muted-foreground mb-1 text-xs">Speed</div>
              <div className="text-lg">{frame.vehicle.speed_kmh.toFixed(1)} km/h</div>
            </div>
            <div className="h-14 w-px bg-border"></div>
            <div className="min-w-30 grow">
              <div className="text-muted-foreground mb-1 text-xs">Objects Detected</div>
              <div className="text-lg">{data.frames[frameIdx].detected_objects.length}</div>
            </div>
          </div>
        </div>

        {/* Panel 1: LiDAR Point Cloud */}
        <div className="bg-card/30 backdrop-blur-xs border border-border rounded-xl shadow-sm h-fit p-3">
          <div className="w-full flex justify-between gap-3 mb-3">
            <div className="w-fit h-fit bg-card rounded-sm px-3 py-2 text-sm">
              Live LiDAR Point Cloud
            </div>
            <div className="w-fit h-fit rounded-sm px-3 py-2 text-sm text-muted-foreground">
              3D · Object Detection
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <div className="relative grow h-140 bg-background rounded-md overflow-hidden">
              <LidarScene data={data} frameIdxRef={frameIdxRef} />
            </div>
            <div className="w-74 h-fit bg-card rounded-md">
              <MetricsHUD
                metrics={frame.metrics}
                fps={fps}
                memorySavingsPct={gridResult.memorySavingsPct}
                frameId={frame.frame_id}
              />
            </div>
          </div>
        </div>

        {/* Panel 2: Semantic Map */}
        <div className="bg-card/30 backdrop-blur-xs border border-border rounded-xl shadow-sm h-fit p-3">
          <div className="w-full flex justify-between gap-3 mb-3">
            <div className="w-fit h-fit bg-card rounded-sm px-3 py-2 text-sm">
              Foveated Semantic Map
            </div>
            <div className="w-fit h-fit rounded-sm px-3 py-2 text-sm text-muted-foreground">
              2.5D · Variable Resolution Grid
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <div className="w-74 h-fit bg-card rounded-md">
              <MemorySavingsHUD gridResult={gridResult} />
            </div>
            <div className="w-full grow space-y-3">
              <div className="relative w-full h-140 bg-background rounded-md overflow-hidden">
                <SemanticMap2D data={data} frameIdx={frameIdx} />
              </div>
              <SemanticLegend />
            </div>
          </div>
        </div>

        {/* Panel 3: Elevation Map */}
        <div className="bg-card/30 backdrop-blur-xs border border-border rounded-xl shadow-sm h-fit p-3 relative">
          <div className="w-full flex justify-between gap-3 mb-3">
            <div className="w-fit h-fit bg-card rounded-sm px-3 py-2 text-sm">
              Elevation Map
            </div>
            <div className="w-fit h-fit rounded-sm px-3 py-2 text-sm text-muted-foreground">
              3D · Height Gradient
            </div>
          </div>
          <div className="relative w-full h-140 bg-background rounded-md overflow-hidden">
            <ElevationMap3D data={data} frameIdxRef={frameIdxRef} />
          </div>
        </div>

        {/* Panel 4: Cross-section & Accuracy */}
        <div className="bg-card/30 backdrop-blur-xs border border-border rounded-xl shadow-sm h-fit p-3 relative">
          <div className="w-full flex justify-between gap-3 mb-3">
            <div className="w-fit h-fit bg-card rounded-sm px-3 py-2 text-sm">
              Cross-Section & Accuracy
            </div>
            <div className="w-fit h-fit rounded-sm px-3 py-2 text-sm text-muted-foreground">
              2D · Elevation Slice / Classification
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <ElevationSlice data={data} frameIdx={frameIdx} />
          </div>
        </div>

      </div>
    </div>
  );
}
