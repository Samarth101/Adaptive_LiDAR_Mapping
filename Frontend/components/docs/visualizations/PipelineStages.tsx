'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Network, Palette, BoxSelect, Mountain } from 'lucide-react';

interface Point {
  x: number;
  y: number;
  z: number;
  type: string;
}

export default function PipelineStages() {
  const [activeStage, setActiveStage] = useState(1);
  const [manualX, setManualX] = useState(65);
  const [manualZ, setManualZ] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const autoRotateRef = useRef(true);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      if (autoRotateRef.current) {
        setManualZ(prev => (prev + 0.02 * deltaTime) % 360);
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    autoRotateRef.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = e.clientY - dragStart.current.y;

    setManualZ(prev => prev + deltaX * 0.5);
    setManualX(prev => Math.min(Math.max(prev - deltaY * 0.5, 20), 85));

    dragStart.current.x = e.clientX;
    dragStart.current.y = e.clientY;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    autoRotateRef.current = true;
  };

  const stages = [
    { id: 1, name: 'Raw Points', icon: Network, desc: 'Unclassified XYZ coordinate returns from the LiDAR sensor.' },
    { id: 2, name: 'Semantic Segmentation', icon: Palette, desc: 'Deep learning (PointNet++) assigns a class label to every point.' },
    { id: 3, name: 'DBSCAN Clustering', icon: BoxSelect, desc: 'Dynamic semantic points are spatially clustered to detect 3D objects.' },
    { id: 4, name: 'Elevation Map', icon: Mountain, desc: 'Clusters are collapsed onto a 2.5D terrain grid, yielding the final map.' }
  ];

  // Generate realistic point cloud data only on the client to prevent SSR hydration mismatch
  const [points, setPoints] = useState<Point[]>([]);

  useEffect(() => {
    const pts = [];

    // 1. Car Shape
    for (let i = 0; i < 250; i++) {
      const isCabin = Math.random() > 0.6;
      const xOffset = isCabin ? 8 + Math.random() * 14 : Math.random() * 30;
      const yOffset = isCabin ? 4 + Math.random() * 12 : Math.random() * 20;
      const zOffset = isCabin ? 10 + Math.random() * 10 : Math.random() * 10;

      pts.push({ x: 20 + xOffset, y: 30 + yOffset, z: zOffset, type: 'car' });
    }

    // 2. Pedestrian Shape
    for (let i = 0; i < 60; i++) {
      const isHead = Math.random() > 0.8;
      const angle = Math.random() * Math.PI * 2;
      const r = isHead ? Math.random() * 1.5 : Math.random() * 2.5;
      const z = isHead ? 12 + Math.random() * 4 : Math.random() * 12;

      pts.push({ x: 70 + r * Math.cos(angle), y: 70 + r * Math.sin(angle), z: z, type: 'pedestrian' });
    }

    // 3. Tree Shape (Trunk + Canopy)
    for (let i = 0; i < 250; i++) {
      const isTrunk = Math.random() > 0.7;
      const angle = Math.random() * Math.PI * 2;
      const r = isTrunk ? Math.random() * 2 : Math.random() * 8;
      const z = isTrunk ? Math.random() * 15 : 15 + Math.random() * 20;

      pts.push({ x: 80 + r * Math.cos(angle), y: 20 + r * Math.sin(angle), z: z, type: 'tree' });
    }

    // 4. Ground/Noise Points (Unclassified Environment)
    for (let i = 0; i < 500; i++) {
      // 40% ground, 60% scattered 3D points representing buildings, poles, and air noise
      const isGround = Math.random() > 0.6;
      pts.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        z: isGround ? Math.random() * 3 : Math.random() * 50,
        type: 'noise'
      });
    }

    setPoints(pts);
  }, []);

  const getColor = (type: string, stage: number) => {
    // Stage 1: All points are raw (gray/foreground color)
    if (stage === 1) return 'bg-foreground/50';

    // Stages 2+: Points are segmented by color
    switch (type) {
      case 'car': return 'bg-blue-500';
      case 'pedestrian': return 'bg-red-500';
      case 'tree': return 'bg-green-500';
      case 'noise': return 'bg-muted-foreground/30';
      default: return 'bg-foreground/40';
    }
  };

  return (
    <div className="flex-1 md:max-h-160 rounded-4xl overflow-hidden relative flex flex-col md:flex-row gap-2 bg-background border border-border p-2">

      {/* Left panel: Info & Controls */}
      <div className="w-full md:w-1/3 md:max-w-80 bg-radial from-transparent from-10% to-primary/5 to-100% p-4 md:p-6 flex flex-col relative z-10 rounded-2xl overflow-y-auto">
        <div className="text-foreground mb-6 font-medium text-lg px-2">Pipeline Stages</div>

        {/* Timeline */}
        <div className="relative flex flex-col gap-6 px-2">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const isActive = activeStage === stage.id;
            const isPast = activeStage >= stage.id;
            const isLast = index === stages.length - 1;

            return (
              <div key={stage.id} className="relative">
                {/* Connecting Line to next item */}
                {!isLast && (
                  <div className="absolute left-[23px] top-12 bottom-[-1.5rem] w-[2px] bg-border -z-10">
                    <div className={`w-full bg-primary transition-all duration-500 ${activeStage > stage.id ? 'h-full' : 'h-0'}`} />
                  </div>
                )}

                <button
                  onClick={() => setActiveStage(stage.id)}
                  className={`flex items-start text-left gap-4 group transition-all duration-300 w-full ${isPast ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                    }`}
                >
                  <div className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 bg-background transition-colors duration-500 z-10 shrink-0 ${isActive ? 'border-primary text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]' :
                      isPast ? 'border-primary text-primary' : 'border-border text-muted-foreground'
                    }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 pt-1.5 pb-2">
                    <div className={`text-sm font-medium ${isPast ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {stage.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed hidden md:block">
                      {stage.desc}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel: Visualization */}
      <div
        className="w-full md:w-2/3 grow h-[450px] md:h-auto bg-card/30 rounded-2xl relative p-4 md:p-8 min-h-0 overflow-hidden flex items-center justify-center cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Drag Hint */}
        <div className="absolute bottom-4 right-6 text-xs text-muted-foreground/50 pointer-events-none z-20 bg-background/50 backdrop-blur px-2 py-1 rounded">
          Click and drag to rotate
        </div>

        {/* 3D Visualization container */}
        <div
          className="relative w-full h-full max-w-3xl flex items-center justify-center overflow-hidden pointer-events-none"
          style={{ perspective: '1000px' }}
        >
          {/* X-axis rotation (Pitch) and Scale */}
          <div
            className="relative w-96 h-96"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${manualX}deg) scale(1.35)`,
            }}
          >
            {/* Z-axis rotation (Yaw) */}
            <div
              className="relative w-full h-full"
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateZ(${manualZ}deg)`
              }}
            >

              {/* Base grid that appears in stage 4 */}
              <div
                className={`absolute inset-0 border border-border/50 transition-opacity duration-1000 ${activeStage >= 4 ? 'opacity-100' : 'opacity-20'}`}
                style={{
                  backgroundSize: '24px 24px',
                  backgroundImage: 'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)'
                }}
              />

              {/* Render Point Cloud */}
              {points.map((p, i) => (
                <div
                  key={i}
                  className={`absolute rounded-full transition-colors duration-700 shadow-[inset_-1px_-1px_2px_rgba(0,0,0,0.6),inset_1px_1px_2px_rgba(255,255,255,0.4)] ${getColor(p.type, activeStage)}`}
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: '5px',
                    height: '5px',
                    // translateZ lifts it up.
                    // rotateZ and rotateX billboard it to the camera.
                    // translate(-50%, -50%) centers the dot on the coordinate.
                    transform: `translateZ(${p.z * 2}px) rotateZ(${-manualZ}deg) rotateX(${-manualX}deg) translate(-50%, -50%)`
                  }}
                />
              ))}

              {/* Stage 3: Clustering Bounding Boxes */}
              <div className={`absolute inset-0 transition-opacity duration-700 ${activeStage === 3 ? 'opacity-100' : 'opacity-0'} pointer-events-none`}>
                {/* Car */}
                <div className="absolute border-[1.5px] border-blue-500/80 border-dashed" style={{ left: '18%', top: '28%', width: '34%', height: '24%', transform: 'translateZ(0px)' }}>
                  <div
                    className="absolute top-1/2 left-1/2 flex flex-col items-center pointer-events-none"
                    style={{ transform: `translateZ(40px) rotateZ(${-manualZ}deg) rotateX(${-manualX}deg) translate(-50%, -100%)` }}
                  >
                    <div className="text-blue-400 text-[10px] font-mono font-bold tracking-widest bg-blue-950/80 px-2 py-1 rounded border border-blue-500/50 backdrop-blur-md shadow-[0_0_10px_rgba(59,130,246,0.3)] whitespace-nowrap">
                      CAR <span className="text-blue-200/70 ml-1">98%</span>
                    </div>
                    <div className="w-px h-8 bg-gradient-to-b from-blue-500/80 to-transparent mt-1"></div>
                  </div>
                </div>

                {/* Pedestrian */}
                <div className="absolute border-[1.5px] border-red-500/80 border-dashed" style={{ left: '66%', top: '66%', width: '8%', height: '8%', transform: 'translateZ(0px)' }}>
                  <div
                    className="absolute top-1/2 left-1/2 flex flex-col items-center pointer-events-none"
                    style={{ transform: `translateZ(20px) rotateZ(${-manualZ}deg) rotateX(${-manualX}deg) translate(-50%, -100%)` }}
                  >
                    <div className="text-red-400 text-[10px] font-mono font-bold tracking-widest bg-red-950/80 px-2 py-1 rounded border border-red-500/50 backdrop-blur-md shadow-[0_0_10px_rgba(239,68,68,0.3)] whitespace-nowrap">
                      PED <span className="text-red-200/70 ml-1">92%</span>
                    </div>
                    <div className="w-px h-5 bg-gradient-to-b from-red-500/80 to-transparent mt-1"></div>
                  </div>
                </div>

                {/* Tree */}
                <div className="absolute border-[1.5px] border-green-500/80 border-dashed" style={{ left: '71%', top: '11%', width: '18%', height: '18%', transform: 'translateZ(0px)' }}>
                  <div
                    className="absolute top-1/2 left-1/2 flex flex-col items-center pointer-events-none"
                    style={{ transform: `translateZ(45px) rotateZ(${-manualZ}deg) rotateX(${-manualX}deg) translate(-50%, -100%)` }}
                  >
                    <div className="text-green-400 text-[10px] font-mono font-bold tracking-widest bg-green-950/80 px-2 py-1 rounded border border-green-500/50 backdrop-blur-md shadow-[0_0_10px_rgba(34,197,94,0.3)] whitespace-nowrap">
                      TREE <span className="text-green-200/70 ml-1">88%</span>
                    </div>
                    <div className="w-px h-10 bg-gradient-to-b from-green-500/80 to-transparent mt-1"></div>
                  </div>
                </div>
              </div>

              {/* Stage 4: Elevation Map Blocks */}
              <div className={`absolute inset-0 transition-opacity duration-1000 ${activeStage === 4 ? 'opacity-100' : 'opacity-0'} pointer-events-none`}>
                {/* Car Elevation Tile */}
                <div className="absolute bg-blue-500/20 border-t-2 border-blue-400 transition-all duration-1000 shadow-[0_0_15px_rgba(59,130,246,0.3)]" style={{ left: '20%', top: '30%', width: '30%', height: '20%', transform: activeStage === 4 ? 'translateZ(40px)' : 'translateZ(0px)' }} />

                {/* Pedestrian Elevation Tile */}
                <div className="absolute bg-red-500/20 border-t-2 border-red-400 transition-all duration-1000 shadow-[0_0_15px_rgba(239,68,68,0.3)]" style={{ left: '67.5%', top: '67.5%', width: '5%', height: '5%', transform: activeStage === 4 ? 'translateZ(30px)' : 'translateZ(0px)' }} />

                {/* Tree Elevation Tile */}
                <div className="absolute bg-green-500/20 border-t-2 border-green-400 transition-all duration-1000 shadow-[0_0_15px_rgba(34,197,94,0.3)]" style={{ left: '72%', top: '12%', width: '16%', height: '16%', transform: activeStage === 4 ? 'translateZ(70px)' : 'translateZ(0px)' }} />
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
