'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { DemoData, Frame } from '@/types/dataset';
import { buildFoveatedGrid } from '@/lib/foveatedGrid';
import dynamic from 'next/dynamic';
import MetricsHUD from '@/components/lidar/MetricsHUD';
import MemorySavingsHUD from '@/components/lidar/MemorySavingsHUD';
import SemanticLegend from '@/components/lidar/SemanticLegend';
import { Button } from '@/components/ui/button';
import InteractiveDotPattern from '@/components/layout/InteractiveDotPattern';
import { BookOpen, X } from 'lucide-react';
import Image from 'next/image';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { deserializeBinary, FrameData } from '@/lib/binaryProtocol';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';

// Dynamic imports (WebGL / canvas — client only)
const LidarScene = dynamic(() => import('@/components/lidar/LidarScene'), { ssr: false });
const SemanticMap2D = dynamic(() => import('@/components/lidar/SemanticMap2D'), { ssr: false });
const ElevationMap3D = dynamic(() => import('@/components/lidar/ElevationMap3D'), { ssr: false });
const ElevationSlice = dynamic(() => import('@/components/lidar/ElevationSlice'), { ssr: false });

interface Props {
  onFrameChange?: (frame: Frame) => void;
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
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(0);
  const [connected, setConnected] = useState(false);
  const [visualMode, setVisualMode] = useState<'raw' | 'cells'>('raw');

  const wsRef = useRef<WebSocket | null>(null);

  const frameIdxRef = useRef(0);
  const lastFpsTime = useRef(performance.now());
  const fpsFrameCount = useRef(0);

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
  const [dismissedBackendError, setDismissedBackendError] = useState(false);

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
        // Send stop action first so backend streaming loop exits cleanly
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ action: 'stop' }));
        }
        wsRef.current.close(1000, 'User disconnected');
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
    if (data && mode === 'simulated') onFrameChange?.(data.frames[frameIdx]);
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
      Math.max(0, 100 - (liveFrame.cell_x.length / (liveFrame.num_points || liveFrame.raw_x.length)) * 100) :
      0);

  // In live mode, show the actual backend processing FPS, not screen render FPS
  const displayFps = mode === 'live' && liveFrame ? liveFrame.inference_fps : fps;

  return (
    <div className="w-screen bg-transparent text-foreground overflow-y-auto overflow-x-hidden min-h-screen pb-12 relative">
      <InteractiveDotPattern />

      {/* Header */}
      <div className="fixed top-3 left-3 w-fit bg-radial from-transparent from-25% to-primary/10 to-100% backdrop-blur-xs px-6 py-3 rounded-full z-50 border flex items-center justify-center">
        <Image src="/logo.png" alt="Data Exploiters Logo" width={150} height={32} className="h-6 w-auto dark:invert" />
      </div>
      <div className="fixed top-3 right-3 w-fit flex flex-col items-end gap-2 z-50 pointer-events-none">
        {/* Main Right Header */}
        <div className="bg-radial from-transparent from-25% to-primary/15 to-100% backdrop-blur-xs p-2 rounded-full flex items-center gap-2 border pointer-events-auto shadow-sm">
          <Link
            href="/docs"
            className="px-3.5 py-1.5 rounded-full text-sm bg-muted flex items-center gap-1.5 text-foreground"
          >
            <BookOpen className="w-4 h-4" />
            <span>Docs</span>
          </Link>

          {/* Mode Selector */}
          <div className="flex bg-muted rounded-full p-0.5 text-sm">
            <button
              onClick={() => setMode('simulated')}
              className={`px-3 py-1 rounded-full transition-colors ${mode === 'simulated' ? 'bg-foreground text-background shadow-sm' : ''}`}>
              Simulated
            </button>
            <button
              onClick={() => setMode('live')}
              className={`px-3 py-1 rounded-full transition-colors ${mode === 'live' ? 'bg-foreground text-background shadow-sm' : ''}`}>
              Live Backend
            </button>
          </div>

          <ThemeToggle />

          <Button
            onClick={togglePlay}
            variant='default'
            className={"rounded-full px-3"}
          >
            {playing ? 'Pause' : 'Play'}
          </Button>
        </div>

        {/* Sub Header for Live Settings */}
        <div
          className={`transition-all duration-300 ease-out origin-top flex items-center pointer-events-auto ${mode === 'live' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 pointer-events-none'}`}
        >
          <div className="bg-radial from-transparent from-25% to-primary/15 to-100% backdrop-blur-xs p-2 rounded-full flex items-center gap-3 border shadow-sm">
            <select
              className="bg-muted rounded-full px-3 py-1.5 text-sm"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {availableModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="flex bg-muted rounded-full p-0.5 text-sm">
              <button
                onClick={() => setVisualMode('raw')}
                className={`px-3 py-1 rounded-full transition-colors ${visualMode === 'raw' ? 'bg-foreground text-background' : ''}`}>
                Raw Points
              </button>
              <button
                onClick={() => setVisualMode('cells')}
                className={`px-3 py-1 rounded-full transition-colors ${visualMode === 'cells' ? 'bg-foreground text-background' : ''}`}>
                Adaptive Grid
              </button>
            </div>
            <select
              className="bg-muted rounded-full px-3 py-1.5 text-sm"
              value={sequence}
              onChange={(e) => setSequence(e.target.value)}
            >
              {availableSequences.map(s => (
                <option key={s.id} value={s.id}>Seq {s.id} ({s.frame_count} frames)</option>
              ))}
            </select>
            <button
              onClick={() => setConnected(!connected)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${connected ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}
            >
              {connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>
      </div>

      {/* Backend Status Toast */}
      {mode === 'live' && backendOnline === false && !dismissedBackendError && (
        <div className="fixed bottom-4 right-4 z-100 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-radial from-transparent from-25% to-primary/10 to-100% backdrop-blur-md border border-border rounded-2xl p-3 max-w-md relative">
            <button
              onClick={() => setDismissedBackendError(true)}
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors"
              aria-label="Close toast"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              <div className="text-foreground">
                Connection Lost
              </div>
              <div className="text-base text-muted-foreground">
                We're unable to fetch real-time data. The Live Backend is currently unreachable.
              </div>
              <Button
                onClick={() => {
                  setMode('simulated')
                  setDismissedBackendError(true)
                }}
                variant='default'
                className={"mt-3 rounded-full h-10 px-3 w-full"}
              >
                Switch to Simulated
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="mt-20 p-6 space-y-8 max-w-340 mx-auto">


        {/* Metrics Section */}
        <div className="w-full max-w-6xl mx-auto relative">
          <div className="w-[calc(100%-64px)] h-10 bg-muted-foreground/70 backdrop-blur-lg rounded-full absolute -top-3 left-8 z-1" />
          <div className="relative flex not-md:flex-col items-center gap-4 bg-radial from-transparent from-50% to-primary/7 to-100% backdrop-blur-lg z-10 rounded-4xl md:rounded-full border border-border px-8 py-3 text-shadow-2xs">
            <div className="not-md:w-full md:min-w-30 grow not-md:flex items-center justify-between gap-3">
              <div className="text-muted-foreground mb-1 md:text-xs">FPS</div>
              <div className="text-lg">{fps}</div>
            </div>
            <div className="not-md:hidden h-14 w-px bg-border"></div>
            <div className="not-md:w-full md:min-w-30 grow not-md:flex items-center justify-between gap-3">
              <div className="text-muted-foreground mb-1 md:text-xs">Frame</div>
              <div className="text-lg">{currentFrameId}</div>
            </div>
            <div className="not-md:hidden h-14 w-px bg-border"></div>
            <div className="not-md:w-full md:min-w-30 grow not-md:flex items-center justify-between gap-3">
              <div className="text-muted-foreground mb-1 md:text-xs">Speed</div>
              <div className="text-lg">{currentSpeed} km/h</div>
            </div>
            <div className="not-md:hidden h-14 w-px bg-border"></div>
            <div className="not-md:w-full md:min-w-30 grow not-md:flex items-center justify-between gap-3">
              <div className="text-muted-foreground mb-1 md:text-xs">Objects Detected</div>
              <div className="text-lg">{currentObjects}</div>
            </div>
          </div>
        </div>

        {/* Panel 1: LiDAR Point Cloud */}
        <div className="bg-card/30 backdrop-blur-xs border rounded-4xl shadow-sm h-fit p-3">
          <div className="w-full flex justify-between gap-3 mb-3">
            <div className="w-fit h-fit bg-card rounded-xl px-3 py-2 text-sm">
              Live LiDAR Point Cloud
            </div>
            <div className="w-fit h-fit rounded-sm px-3 py-2 text-sm text-muted-foreground">
              3D · Object Detection
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 justify-center">
            <div className="relative w-full md:grow h-80 md:h-140 bg-background rounded-2xl overflow-hidden select-none">
              <LidarScene data={data} frameIdxRef={frameIdxRef} mode={mode} liveFrame={liveFrame} />
            </div>
            <div className="w-full md:w-74 h-fit bg-radial from-transparent from-25% to-primary/10 to-100% rounded-2xl shrink-0">
              <MetricsHUD
                metrics={mode === 'simulated' ? frame.metrics : {
                  objects_detected: currentObjects,
                }}
                fps={displayFps}
                memorySavingsPct={memorySavings}
                frameId={currentFrameId}
                mode={mode}
              />
            </div>
          </div>
        </div>

        {/* Panel 2: Semantic Map */}
        <div className="bg-card/30 backdrop-blur-xs border rounded-4xl shadow-sm h-fit p-3">
          <div className="w-full flex justify-between gap-3 mb-3">
            <div className="w-fit h-fit bg-card rounded-xl px-3 py-2 text-sm">
              Foveated Semantic Map
            </div>
            <div className="w-fit h-fit rounded-sm px-3 py-2 text-sm text-muted-foreground">
              2.5D · Variable Resolution Grid
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-3 justify-center">
            <div className="w-full md:w-74 h-fit bg-card rounded-2xl shrink-0">
              <MemorySavingsHUD gridResult={simulatedGridResult} mode={mode} liveFrame={liveFrame} />
            </div>
            <div className="w-full grow space-y-3 min-w-0">
              <div className="relative w-full h-80 md:h-140 bg-background rounded-2xl overflow-hidden">
                <SemanticMap2D data={data} frameIdx={frameIdx} mode={mode} liveFrame={liveFrame} />
              </div>
              <SemanticLegend />
            </div>
          </div>
        </div>

        {/* Panel 3: Elevation Map */}
        <div className="bg-card/30 backdrop-blur-xs border rounded-4xl shadow-sm h-fit p-3 relative">
          <div className="w-full flex justify-between gap-3 mb-3">
            <div className="w-fit h-fit bg-card rounded-xl px-3 py-2 text-sm">
              Elevation Map
            </div>
            <div className="w-fit h-fit rounded-sm px-3 py-2 text-sm text-muted-foreground">
              3D · Height Gradient
            </div>
          </div>
          <div className="relative w-full h-80 md:h-140 bg-background rounded-2xl overflow-hidden">
            <ElevationMap3D data={data} frameIdxRef={frameIdxRef} mode={mode} liveFrame={liveFrame} />
          </div>
        </div>

        {/* Panel 4: Cross-section & Accuracy (Simulated Mode) */}
        {mode === 'simulated' && (
          <div className="bg-card/30 backdrop-blur-xs border rounded-4xl shadow-sm h-fit p-3 relative">
            <div className="w-full flex justify-between gap-3 mb-3">
              <div className="w-fit h-fit bg-card rounded-xl px-3 py-2 text-sm">
                Cross-Section & Accuracy
              </div>
              <div className="w-fit h-fit rounded-sm px-3 py-2 text-sm text-muted-foreground">
                2D · Elevation Slice / Classification
              </div>
            </div>
            <div className="relative w-full h-60 md:h-110 overflow-hidden">
              <ElevationSlice data={data} frameIdx={frameIdx} />
            </div>
          </div>
        )}

      </div>
      <Footer />
    </div>
  );
}
