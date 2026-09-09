'use client';

import React, { useState } from 'react';
import { MousePointer2 } from 'lucide-react';

export default function UniformVsAdaptive() {
  const [mode, setMode] = useState<'uniform' | 'adaptive'>('uniform');
  const [hoveredCell, setHoveredCell] = useState<{ x: number, y: number, res: string } | null>(null);

  // Generate grid for SVG
  const gridSize = 400; // SVG viewBox size
  const center = { x: 200, y: 200 };

  const renderUniformGrid = () => {
    const cells = [];
    const step = 20; // 20x20 uniform cells
    for (let x = 0; x < gridSize; x += step) {
      for (let y = 0; y < gridSize; y += step) {
        cells.push(
          <rect 
            key={`u-${x}-${y}`} 
            x={x} y={y} width={step} height={step} 
            className="fill-slate-900 stroke-slate-700/50 hover:fill-cyan-900/50 transition-colors cursor-pointer"
            onMouseEnter={() => setHoveredCell({ x, y, res: '5 cm' })}
            onMouseLeave={() => setHoveredCell(null)}
          />
        );
      }
    }
    return cells;
  };

  const renderAdaptiveGrid = () => {
    const cells = [];
    
    // Band 1: Center high resolution (5cm)
    const b1Step = 20;
    for (let x = 120; x < 280; x += b1Step) {
      for (let y = 120; y < 280; y += b1Step) {
        cells.push(
          <rect key={`a1-${x}-${y}`} x={x} y={y} width={b1Step} height={b1Step} 
            className="fill-slate-900 stroke-cyan-500/80 hover:fill-cyan-900 cursor-pointer"
            onMouseEnter={() => setHoveredCell({ x, y, res: '5 cm' })}
            onMouseLeave={() => setHoveredCell(null)}
          />
        );
      }
    }

    // Band 2: Mid resolution (10cm)
    const b2Step = 40;
    for (let x = 40; x < 360; x += b2Step) {
      for (let y = 40; y < 360; y += b2Step) {
        // Skip center block
        if (x >= 120 && x < 280 && y >= 120 && y < 280) continue;
        cells.push(
          <rect key={`a2-${x}-${y}`} x={x} y={y} width={b2Step} height={b2Step} 
            className="fill-slate-900 stroke-cyan-600/50 hover:fill-cyan-900/70 cursor-pointer"
            onMouseEnter={() => setHoveredCell({ x, y, res: '10 cm' })}
            onMouseLeave={() => setHoveredCell(null)}
          />
        );
      }
    }

    // Band 3: Low resolution (50cm)
    const b3Step = 80;
    for (let x = 0; x < gridSize; x += b3Step) {
      for (let y = 0; y < gridSize; y += b3Step) {
        // Skip inner blocks
        if (x >= 40 && x < 360 && y >= 40 && y < 360) continue;
        cells.push(
          <rect key={`a3-${x}-${y}`} x={x} y={y} width={b3Step} height={b3Step} 
            className="fill-slate-900 stroke-cyan-800/30 hover:fill-cyan-900/40 cursor-pointer"
            onMouseEnter={() => setHoveredCell({ x, y, res: '50 cm' })}
            onMouseLeave={() => setHoveredCell(null)}
          />
        );
      }
    }
    
    return cells;
  };

  return (
    <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 flex overflow-hidden shadow-2xl relative">
      
      {/* Left panel: Info & Controls */}
      <div className="w-1/3 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between relative z-10">
        <div>
          <h3 className="text-xl font-bold text-slate-100 mb-4">Memory Bottleneck</h3>
          <p className="text-slate-400 text-sm mb-6">
            A uniform grid maps the distant sky and close-up roads with the exact same resolution. 
            This creates massive, unnecessary spatial arrays in GPU memory.
          </p>

          <div className="flex flex-col gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button 
              onClick={() => setMode('uniform')}
              className={`py-3 px-4 text-sm font-medium rounded-md transition-all flex justify-between items-center ${
                mode === 'uniform' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>Uniform Grid (5cm)</span>
              {mode === 'uniform' && <span className="w-2 h-2 rounded-full bg-cyan-500" />}
            </button>
            <button 
              onClick={() => setMode('adaptive')}
              className={`py-3 px-4 text-sm font-medium rounded-md transition-all flex justify-between items-center ${
                mode === 'adaptive' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>Adaptive Grid (5 - 50cm)</span>
              {mode === 'adaptive' && <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]" />}
            </button>
          </div>
        </div>

        <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 mt-8">
          <div className="text-xs text-slate-500 mb-1 font-mono uppercase tracking-wider">Live Metrics</div>
          <div className="flex justify-between items-baseline mb-4">
            <div className="text-slate-400 text-sm">Total Cells</div>
            <div className="text-2xl font-mono text-cyan-400 transition-all duration-500">
              {mode === 'uniform' ? '40,000' : '484'}
            </div>
          </div>
          <div className="flex justify-between items-baseline">
            <div className="text-slate-400 text-sm">Memory Savings</div>
            <div className="text-2xl font-mono text-emerald-400 transition-all duration-500">
              {mode === 'uniform' ? '0.0%' : '98.7%'}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel: SVG Visualization */}
      <div className="w-2/3 bg-[#020617] relative flex items-center justify-center p-8">
        
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

        <div className="relative w-full max-w-[500px] aspect-square">
          <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-[0_0_30px_rgba(6,182,212,0.15)] relative z-10">
            {mode === 'uniform' ? renderUniformGrid() : renderAdaptiveGrid()}
            
            {/* Center ego vehicle marker */}
            <circle cx={center.x} cy={center.y} r={6} className="fill-emerald-500 shadow-xl" />
            <circle cx={center.x} cy={center.y} r={12} className="fill-none stroke-emerald-500/50 stroke-[2] animate-ping" />
          </svg>

          {/* Tooltip on hover */}
          {hoveredCell && (
            <div 
              className="absolute pointer-events-none bg-slate-900 border border-cyan-500/50 text-cyan-50 px-3 py-2 rounded shadow-xl text-xs z-20 flex flex-col gap-1 transition-all"
              style={{
                left: `calc(${(hoveredCell.x / 400) * 100}% + 20px)`,
                top: `calc(${(hoveredCell.y / 400) * 100}% - 10px)`
              }}
            >
              <div className="flex items-center gap-2 text-slate-400">
                <MousePointer2 className="w-3 h-3" /> Cell Inspector
              </div>
              <div>Res: <span className="font-mono text-cyan-400">{hoveredCell.res}</span></div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
