'use client';

import React, { useState, useEffect } from 'react';
import { Target, Layers, Box, Cpu } from 'lucide-react';
import { useDocsAnimation } from '@/components/docs/DocsAnimationContext';

export default function CellInspector() {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const { isPaused } = useDocsAnimation();

  // Auto-cycle through the stages for demonstration
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setStage((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
    }, 4000);
    return () => clearInterval(timer);
  }, [isPaused]);

  return (
    <div className="flex-1 bg-background rounded-xl border border-border flex overflow-hidden shadow-2xl relative">
      
      {/* Left panel: Info & Controls */}
      <div className="w-1/3 bg-card border-r border-border p-6 flex flex-col relative z-10">
        <div>
          <h3 className="text-xl font-normal text-foreground mb-4">Inside One Adaptive Cell</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Instead of just rendering flat pixels, each cell in our foveated grid acts as an intelligent spatial container. 
            Here is how it processes raw point data.
          </p>

          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setStage(0)}
              className={`p-3 text-left text-sm font-normal rounded-md transition-all border ${
                stage === 0 ? 'bg-primary/10 text-primary border-primary/30' : 'bg-background text-muted-foreground/70 border-border hover:text-muted-foreground'
              }`}
            >
              <span className="block font-normal mb-1">1. Raw LiDAR Points</span>
              <span className="text-xs font-normal">Cell collects all unstructured points falling within its boundaries.</span>
            </button>
            <button 
              onClick={() => setStage(1)}
              className={`p-3 text-left text-sm font-normal rounded-md transition-all border ${
                stage === 1 ? 'bg-primary/10 text-primary border-primary/30' : 'bg-background text-muted-foreground/70 border-border hover:text-muted-foreground'
              }`}
            >
              <span className="block font-normal mb-1">2. Semantic AI (PointNet++)</span>
              <span className="text-xs font-normal">Deep learning classifies each individual point (e.g. road, car, tree).</span>
            </button>
            <button 
              onClick={() => setStage(2)}
              className={`p-3 text-left text-sm font-normal rounded-md transition-all border ${
                stage === 2 ? 'bg-primary/10 text-primary border-primary/30' : 'bg-background text-muted-foreground/70 border-border hover:text-muted-foreground'
              }`}
            >
              <span className="block font-normal mb-1">3. Cell Compression</span>
              <span className="text-xs font-normal">Points are collapsed using majority-voting and elevation statistics.</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right panel: Visualization */}
      <div className="w-2/3 relative flex bg-background p-8 items-center justify-center">
        
        {/* Cell bounding box visualization */}
        <div className="relative w-72 h-72 border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center perspective-[800px]">
          
          {/* Stage 0 & 1: Points */}
          <div className={`absolute inset-0 transition-opacity duration-700 ${stage < 2 ? 'opacity-100' : 'opacity-0'}`}>
             {/* Simulated points distribution (CSS dots) */}
             <div className="absolute top-[20%] left-[30%] w-2 h-2 rounded-full shadow-lg transition-colors duration-1000" style={{ backgroundColor: stage === 0 ? '#666666' : '#d4d4d4' }} />
             <div className="absolute top-[25%] left-[35%] w-2 h-2 rounded-full shadow-lg transition-colors duration-1000" style={{ backgroundColor: stage === 0 ? '#666666' : '#d4d4d4' }} />
             <div className="absolute top-[30%] left-[25%] w-2 h-2 rounded-full shadow-lg transition-colors duration-1000" style={{ backgroundColor: stage === 0 ? '#666666' : '#d4d4d4' }} />
             <div className="absolute top-[40%] left-[60%] w-2 h-2 rounded-full shadow-lg transition-colors duration-1000" style={{ backgroundColor: stage === 0 ? '#666666' : '#a3a3a3' }} />
             <div className="absolute top-[45%] left-[55%] w-2 h-2 rounded-full shadow-lg transition-colors duration-1000" style={{ backgroundColor: stage === 0 ? '#666666' : '#a3a3a3' }} />
             
             {/* Text floating near points in stage 1 */}
             {stage === 1 && (
               <>
                 <div className="absolute top-[10%] left-[10%] text-[10px] text-sky-400 font-mono animate-fade-in">CAR (0.92)</div>
                 <div className="absolute top-[50%] left-[65%] text-[10px] text-green-400 font-mono animate-fade-in">ROAD (0.88)</div>
               </>
             )}
          </div>

          {/* Stage 2: Final Compressed Cell */}
          <div className={`absolute inset-0 transition-all duration-700 bg-sky-500/20 border border-sky-500/50 rounded-lg flex flex-col items-center justify-center backdrop-blur-sm ${stage === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <span className="text-sky-400 font-normal tracking-normal mb-2">FINAL CELL</span>
            
            <div className="bg-card/80 border border-border/50 rounded p-3 w-56 text-xs font-mono space-y-1 text-muted-foreground">
              <div className="flex justify-between"><span>X, Y:</span> <span className="text-foreground">73.50, 11.50</span></div>
              <div className="flex justify-between"><span>Resolution:</span> <span className="text-foreground">0.25 m</span></div>
              <div className="flex justify-between"><span>Elevation:</span> <span className="text-foreground">-0.027 m</span></div>
              <div className="flex justify-between"><span>Max Height:</span> <span className="text-foreground">1.825 m</span></div>
              <div className="flex justify-between border-t border-border/50 pt-1 mt-1">
                <span>Semantic:</span> <span className="text-sky-400 font-normal">CAR</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Sidebar drawer representation for Stage 2 */}
        <div className={`absolute right-0 top-0 bottom-0 w-64 bg-card border-l border-border p-6 transition-transform duration-500 ease-out flex flex-col justify-center ${stage === 2 ? 'translate-x-0' : 'translate-x-full'}`}>
          <h4 className="text-emerald-400 font-normal flex items-center gap-2 mb-4"><Cpu className="w-4 h-4"/> Data Reduced</h4>
          <p className="text-muted-foreground text-xs mb-4">
            5 raw floats per point × 54 points = <span className="text-foreground font-mono">1,080 bytes</span>.
          </p>
          <div className="h-4 w-0.5 bg-muted-foreground/20 mx-auto my-2"></div>
          <p className="text-muted-foreground text-xs mt-4">
            1 compressed cell structure = <span className="text-emerald-400 font-normal font-mono">16 bytes</span>.
          </p>
          <div className="mt-8 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-xs font-normal text-center">
            98.5% Memory Savings
          </div>
        </div>

      </div>
    </div>
  );
}
