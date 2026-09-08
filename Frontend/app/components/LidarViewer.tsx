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
import { Play, Pause, Moon, Sun, GitBranch, Settings } from 'lucide-react';
import Image from 'next/image';
import { deserializeBinary, FrameData } from '../lib/binaryProtocol';

// Dynamic imports (WebGL / canvas — client only)
const LidarScene = dynamic(() => import('./LidarScene'), { ssr: false });
const SemanticMap2D = dynamic(() => import('./SemanticMap2D'), { ssr: false });
const ElevationMap3D = dynamic(() => import('./ElevationMap3D'), { ssr: false });
const ElevationSlice = dynamic(() => import('./ElevationSlice'), { ssr: false });

interface Props {
  onFrameChange: (frame: Frame) => void;
}

export default function LidarViewer({ onFrameChange }: Props) {
  // Mode Selection
  const [mode, setMode] = useState<'simulated' | 'live'>('simulated');
  const [model, setModel] = useState<string>('pointnet2');
  const [availableModels, setAvailableModels] = useState<string[]>(['pointnet2', 'cylinder3d', 'minkunet']);
  const [sequence, setSequence] = useState<string>('00');
  const [availableSequences, setAvailableSequences] = useState<any[]>([]);
  
  // Data states
  const [data, setData] = useState<DemoData | null>(null);
  const [liveFrame, setLiveFrame] = useState<FrameData | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(0);
  const [isDark, setIsDark] = useState(true);
  const [connected, setConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);

  const frameIdxRef = useRef(0);
  const lastFpsTime = useRef(performance.now());
  const fpsFrameCount = useRef(0);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return next;
    });
  }, []);

  // FPS counter
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

  // Load Simulated Data
  useEffect(() => {
    fetch('/data/autonomous_driving_demo_data.json')
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() as Promise<DemoData>; })
      .then((json) => { setData(json); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [backendErrorMsg, setBackendErrorMsg] = useState<string | null>(null);

  // Load models & sequences from backend with graceful fallback
  useEffect(() => {
    let isMounted = true;

    const checkBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const resModels = await fetch('http://localhost:8000/api/models', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!resModels.ok) throw new Error(`HTTP ${resModels.status}`);
        const modelsData = await resModels.json();
        
        if (isMounted) {
          if (Array.isArray(modelsData) && modelsData.length > 0) {
            setAvailableModels(modelsData.map((m: any) => m.name));
          }
          setBackendOnline(true);
          setBackendErrorMsg(null);
        }

        const resSeq = await fetch('http://localhost:8000/api/sequences');
        if (resSeq.ok) {
          const seqData = await resSeq.json();
          if (isMounted && Array.isArray(seqData)) {
            setAvailableSequences(seqData);
            if (seqData.length > 0 && !seqData.find((s: any) => s.id === sequence)) {
              setSequence(seqData[0].id);
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn("Backend API unavailable, continuing in simulated mode:", err?.message || err);
          setBackendOnline(false);
          setBackendErrorMsg("ML Backend Offline (http://localhost:8000)");
        }
      }
    };

    checkBackend();
    return () => { isMounted = false; };
  }, [sequence]);

  // WebSocket for Live Data
  useEffect(() => {
    if (mode === 'simulated' || !connected) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    setLiveFrame(null); // Clear old frame when reconnecting/switching

    const ws = new WebSocket('ws://localhost:8000/ws/stream');
    ws.binaryType = 'arraybuffer';
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ action: "start", model: model, sequence: sequence }));
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        console.log("WS msg:", event.data);
      } else {
        try {
          const frame = deserializeBinary(event.data);
          setLiveFrame(frame);
        } catch (e) {
          console.error("Binary parse error:", e);
        }
      }
    };
    
    ws.onerror = (e) => {
      console.error("WS error:", e);
    };

    ws.onclose = () => {
      console.log("WS connection closed");
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [mode, sequence, model, connected]);

  // Handle Play/Pause for Live WS
  useEffect(() => {
    if (mode === 'live' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: playing ? 'resume' : 'pause' }));
    }
  }, [playing, mode]);

  // Simulated playback loop
  useEffect(() => {
    if (!playing || !data || mode === 'live') return;
    const id = setInterval(() => setFrameIdx((i) => (i + 1) % data.frames.length), 500);
    return () => clearInterval(id);
  }, [playing, data, mode]);

  useEffect(() => {
    if (data && mode === 'simulated') onFrameChange(data.frames[frameIdx]);
  }, [data, frameIdx, onFrameChange, mode]);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  const simulatedGridResult = useMemo(() => {
    if (!data) return null;
    const frame = data.frames[frameIdx];
    return buildFoveatedGrid(data.static_environment.lidar_points, frame.vehicle.position[0], frame.vehicle.position[1]);
  }, [data, frameIdx]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <div className="w-9 h-9 border-2 border-border border-t-primary rounded-full animate-spin" />
        <p>Loading</p>
      </div>
    );
  }
  if (error || !data || !simulatedGridResult) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p>Failed to load</p>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const frame = data.frames[frameIdx];
  
  // Create unified representation to pass to components
  // To avoid rewriting every component heavily, we pass `mode`, `liveFrame`, `data` (sim data) and let them handle it.
  
  const currentSpeed = mode === 'simulated' ? frame.vehicle.speed_kmh.toFixed(1) : (liveFrame ? 'N/A' : '0.0');
  const currentObjects = mode === 'simulated' ? frame.detected_objects.length : (liveFrame?.obj_id?.length ?? 0);
  const currentFrameId = mode === 'simulated' ? frame.frame_id : (liveFrame?.frame_id ?? 0);
  const memorySavings = mode === 'simulated' ? 
    (simulatedGridResult?.memorySavingsPct ?? 0) : 
    (liveFrame?.raw_x && liveFrame?.cell_x ? 
      Math.max(0, 100 - (liveFrame.cell_x.length / liveFrame.raw_x.length) * 100) : 
      0);

  return (
    <div className="w-screen bg-transparent text-foreground overflow-y-auto overflow-x-hidden min-h-screen pb-12 relative">
      <InteractiveDotPattern />

      {/* Header */}
      <div className="fixed top-3 left-3 w-fit bg-card/30 backdrop-blur-xs px-6 py-3 rounded-full z-50 border flex items-center justify-center">
        <Image src="/logo.png" alt="Data Exploiters Logo" width={150} height={32} className="h-6 w-auto dark:invert" />
      </div>
      <div className="fixed top-3 right-3 w-fit bg-card/30 backdrop-blur-xs px-3 py-2 rounded-full flex items-center gap-3 z-50 border">
        
        {/* Mode Selector */}
        <div className="flex bg-muted rounded-full p-1 text-sm border border-border">
            <button 
                onClick={() => setMode('simulated')} 
                className={`px-3 py-1 rounded-full transition-colors ${mode === 'simulated' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                Simulated
            </button>
            <button 
                onClick={() => setMode('live')} 
                className={`px-3 py-1 rounded-full transition-colors ${mode === 'live' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}>
                Live Backend
            </button>
        </div>

        {/* Model Selector */}
        {mode === 'live' && (
            <select 
                className="bg-background border border-border rounded-full px-3 py-1.5 text-sm"
                value={model}
                onChange={(e) => setModel(e.target.value)}
            >
                {availableModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                ))}
            </select>
        )}
        
        {/* Sequence Selector */}
        {mode === 'live' && (
            <select 
                className="bg-background border border-border rounded-full px-3 py-1.5 text-sm"
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
            >
                {availableSequences.map(s => (
                    <option key={s.id} value={s.id}>Seq {s.id} ({s.frame_count} frames)</option>
                ))}
            </select>
        )}

        {mode === 'live' && (
            <button
                onClick={() => setConnected(!connected)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${connected ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}
            >
                {connected ? 'Disconnect' : 'Connect'}
            </button>
        )}

        <button
          onClick={toggleTheme}
          className="relative flex gap-2 w-fit h-fit rounded-full bg-muted transition-colors p-2 cursor-pointer ml-2"
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

        {/* Backend Status Banner */}
        {backendOnline === false && (
          <div className="w-full max-w-6xl mx-auto -mb-4">
            {mode === 'live' ? (
              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-sm">
                <div className="text-sm">
                  <span className="font-semibold">⚠️ ML Backend Offline: </span>
                  Cannot connect to <code className="bg-background/60 px-1.5 py-0.5 rounded font-mono text-xs">http://localhost:8000</code>.
                  Please start the backend with <code className="bg-background/60 px-1.5 py-0.5 rounded font-mono text-xs">python .\backend\server.py</code> to stream live data.
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMode('simulated')}
                  className="rounded-full border-amber-500/40 hover:bg-amber-500/20 text-xs shrink-0"
                >
                  Switch to Simulated
                </Button>
              </div>
            ) : (
              <div className="w-fit mx-auto px-4 py-1.5 rounded-full text-xs bg-muted/70 border border-border text-muted-foreground flex items-center gap-2 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Backend API offline (http://localhost:8000) — Simulated mode running standalone</span>
              </div>
            )}
          </div>
        )}

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
              <div className="text-lg">{currentFrameId}</div>
            </div>
            <div className="h-14 w-px bg-border"></div>
            <div className="min-w-30 grow">
              <div className="text-muted-foreground mb-1 text-xs">Speed</div>
              <div className="text-lg">{currentSpeed} km/h</div>
            </div>
            <div className="h-14 w-px bg-border"></div>
            <div className="min-w-30 grow">
              <div className="text-muted-foreground mb-1 text-xs">Objects Detected</div>
              <div className="text-lg">{currentObjects}</div>
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
              <LidarScene data={data} frameIdxRef={frameIdxRef} mode={mode} liveFrame={liveFrame} />
            </div>
            <div className="w-74 h-fit bg-card rounded-md">
              <MetricsHUD
                metrics={mode === 'simulated' ? frame.metrics : {
                  objects_detected: currentObjects,
                }}
                fps={fps}
                memorySavingsPct={memorySavings}
                frameId={currentFrameId}
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
              <MemorySavingsHUD gridResult={simulatedGridResult} mode={mode} liveFrame={liveFrame} />
            </div>
            <div className="w-full grow space-y-3">
              <div className="relative w-full h-140 bg-background rounded-md overflow-hidden">
                <SemanticMap2D data={data} frameIdx={frameIdx} mode={mode} liveFrame={liveFrame} />
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
            <ElevationMap3D data={data} frameIdxRef={frameIdxRef} mode={mode} liveFrame={liveFrame} />
          </div>
        </div>

        {/* Panel 4: Cross-section & Accuracy (Simulated Mode) */}
        {mode === 'simulated' && (
          <div className="bg-card/30 backdrop-blur-xs border border-border rounded-xl shadow-sm h-fit p-3 relative">
            <div className="w-full flex justify-between gap-3 mb-3">
              <div className="w-fit h-fit bg-card rounded-sm px-3 py-2 text-sm">
                Cross-Section & Accuracy
              </div>
              <div className="w-fit h-fit rounded-sm px-3 py-2 text-sm text-muted-foreground">
                2D · Elevation Slice / Classification
              </div>
            </div>
            <div className="relative w-full h-110 overflow-hidden">
              <ElevationSlice data={data} frameIdx={frameIdx} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
