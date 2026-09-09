'use client';

import React, { useState, useEffect } from 'react';
import { Target, Layers, Box, Cpu } from 'lucide-react';

export default function CellInspector() {
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  // Auto-cycle through the stages for demonstration
  useEffect(() => {
    const timer = setInterval(() => {
      setStage((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 flex overflow-hidden shadow-2xl relative">
      
      {/* Left panel: Info & Controls */}
      <div className="w-1/3 bg-slate-900 border-r border-slate-800 p-6 flex flex-col relative z-10">
        <div>
          <h3 className="text-xl font-bold text-slate-100 mb-4">Inside One Adaptive Cell</h3>
          <p className="text-slate-400 text-sm mb-6">
            Instead of just rendering flat pixels, each cell in our foveated grid acts as an intelligent spatial container. 
            Here is how it processes raw point data.
          </p>

          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setStage(0)}
              className={`p-3 text-left text-sm font-medium rounded-md transition-all border ${
                stage === 0 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              <span className="block font-bold mb-1">1. Raw LiDAR Points</span>
              <span className="text-xs font-normal">Cell collects all unstructured points falling within its boundaries.</span>
            </button>
            <button 
              onClick={() => setStage(1)}
              className={`p-3 text-left text-sm font-medium rounded-md transition-all border ${
                stage === 1 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              <span className="block font-bold mb-1">2. Semantic AI (PointNet++)</span>
              <span className="text-xs font-normal">Deep learning classifies each individual point (e.g. road, car, tree).</span>
            </button>
            <button 
              onClick={() => setStage(2)}
              className={`p-3 text-left text-sm font-medium rounded-md transition-all border ${
                stage === 2 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              <span className="block font-bold mb-1">3. Cell Compression</span>
              <span className="text-xs font-normal">Points are collapsed using majority-voting and elevation statistics.</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right panel: Visualization */}
      <div className="w-2/3 relative flex bg-[#020617] p-8 items-center justify-center">
        
        {/* Cell bounding box visualization */}
        <div className="relative w-72 h-72 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center perspective-[800px]">
          
          {/* Stage 0 & 1: Points */}
          <div className={`absolute inset-0 transition-opacity duration-700 ${stage < 2 ? 'opacity-100' : 'opacity-0'}`}>
             {/* Simulated points distribution (CSS dots) */}
             <div className="absolute top-[20%] left-[30%] w-2 h-2 rounded-full shadow-lg transition-colors duration-1000" style={{ backgroundColor: stage === 0 ? '#475569' : '#0ea5e9' }} />
             <div className="absolute top-[25%] left-[35%] w-2 h-2 rounded-full shadow-lg transition-colors duration-1000" style={{ backgroundColor: stage === 0 ? '#475569' : '#0ea5e9' }} />
             <div className="absolute top-[30%] left-[25%] w-2 h-2 rounded-full shadow-lg transition-colors duration-1000" style={{ backgroundColor: stage === 0 ? '#475569' : '#0ea5e9' }} />
             <div className="absolute top-[40%] left-[60%] w-2 h-2 rounded-full shadow-lg transition-colors duration-1000" style={{ backgroundColor: stage === 0 ? '#475569' : '#22c55e' }} />
             <div className="absolute top-[45%] left-[55%] w-2 h-2 rounded-full shadow-lg transition-colors duration-1000" style={{ backgroundColor: stage === 0 ? '#475569' : '#22c55e' }} />
             
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
            <span className="text-sky-400 font-bold tracking-wider mb-2">FINAL CELL</span>
            
            <div className="bg-slate-900/80 border border-slate-700 rounded p-3 w-56 text-xs font-mono space-y-1 text-slate-300">
              <div className="flex justify-between"><span>X, Y:</span> <span className="text-slate-100">73.50, 11.50</span></div>
              <div className="flex justify-between"><span>Resolution:</span> <span className="text-slate-100">0.25 m</span></div>
              <div className="flex justify-between"><span>Elevation:</span> <span className="text-slate-100">-0.027 m</span></div>
              <div className="flex justify-between"><span>Max Height:</span> <span className="text-slate-100">1.825 m</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
                <span>Semantic:</span> <span className="text-sky-400 font-bold">CAR</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Sidebar drawer representation for Stage 2 */}
        <div className={`absolute right-0 top-0 bottom-0 w-64 bg-slate-900 border-l border-slate-800 p-6 transition-transform duration-500 ease-out flex flex-col justify-center ${stage === 2 ? 'translate-x-0' : 'translate-x-full'}`}>
          <h4 className="text-emerald-400 font-bold flex items-center gap-2 mb-4"><Cpu className="w-4 h-4"/> Data Reduced</h4>
          <p className="text-slate-400 text-xs mb-4">
            5 raw floats per point × 54 points = <span className="text-slate-200 font-mono">1,080 bytes</span>.
          </p>
          <div className="h-4 w-0.5 bg-slate-700 mx-auto my-2"></div>
          <p className="text-slate-400 text-xs mt-4">
            1 compressed cell structure = <span className="text-emerald-400 font-bold font-mono">16 bytes</span>.
          </p>
          <div className="mt-8 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-xs font-medium text-center">
            98.5% Memory Savings
          </div>
        </div>

      </div>
    </div>
  );
}
