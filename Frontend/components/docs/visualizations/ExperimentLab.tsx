'use client';

import React, { useState } from 'react';
import { Settings2, Zap, Database, Clock } from 'lucide-react';

export default function ExperimentLab() {
  const [useAdaptive, setUseAdaptive] = useState(true);
  const [useDBSCAN, setUseDBSCAN] = useState(true);
  const [model, setModel] = useState('pointnet2');

  // Simulated metrics based on toggles
  const getMetrics = () => {
    let cells = 124668; // Base raw points
    let memPct = 0;
    let fps = 0.4;
    let latency = 2500; // ms

    if (model === 'minkunet') { fps = 12.8; latency = 78; }
    if (model === 'cylinder3d') { fps = 14; latency = 71; }

    if (useAdaptive) {
      cells = 49539;
      memPct = 98.7;
    } else {
      cells = 124668;
      memPct = 40.2; // just 3D to 2.5D uniform conversion savings
    }

    if (useDBSCAN) {
      latency += 15; // DBSCAN overhead
      fps = parseFloat((fps * 0.95).toFixed(1));
    }

    return { cells, memPct, fps, latency };
  };

  const metrics = getMetrics();

  return (
    <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 flex overflow-hidden shadow-2xl relative">
      
      {/* Sidebar Controls */}
      <div className="w-1/3 bg-slate-900 border-r border-slate-800 p-6 flex flex-col relative z-10">
        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-6">
          <Settings2 className="w-5 h-5 text-cyan-400" /> Pipeline Parameters
        </h3>

        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Spatial Resolution</label>
            <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
              <button 
                onClick={() => setUseAdaptive(false)}
                className={`flex-1 py-2 text-sm rounded transition-all ${!useAdaptive ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Uniform (5cm)
              </button>
              <button 
                onClick={() => setUseAdaptive(true)}
                className={`flex-1 py-2 text-sm rounded transition-all ${useAdaptive ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Foveated Adaptive
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Semantic Model</label>
            <div className="flex flex-col gap-1 bg-slate-950 rounded-lg p-1 border border-slate-800">
              <button onClick={() => setModel('pointnet2')} className={`py-2 px-3 text-left text-sm rounded transition-all ${model === 'pointnet2' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>PointNet++ (Baseline)</button>
              <button onClick={() => setModel('minkunet')} className={`py-2 px-3 text-left text-sm rounded transition-all ${model === 'minkunet' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>MinkUNet (Sparse)</button>
              <button onClick={() => setModel('cylinder3d')} className={`py-2 px-3 text-left text-sm rounded transition-all ${model === 'cylinder3d' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>Cylinder3D (High Acc)</button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Object Detection</label>
            <button 
              onClick={() => setUseDBSCAN(!useDBSCAN)}
              className={`w-full py-2 text-sm rounded transition-all border ${useDBSCAN ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'}`}
            >
              {useDBSCAN ? 'DBSCAN Enabled' : 'DBSCAN Disabled'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Dashboard Display */}
      <div className="w-2/3 bg-[#020617] p-8 flex flex-col justify-center">
        
        <h4 className="text-2xl font-bold text-slate-100 mb-8 text-center">Simulated Performance Impact</h4>

        <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto w-full">
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-cyan-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Database className="w-6 h-6 text-cyan-500 mb-2" />
            <span className="text-slate-400 text-sm mb-1">Spatial Elements</span>
            <span className="text-3xl font-mono text-slate-100">{metrics.cells.toLocaleString()}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
             <div className="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Zap className="w-6 h-6 text-emerald-500 mb-2" />
            <span className="text-slate-400 text-sm mb-1">Memory Savings</span>
            <span className="text-3xl font-mono text-emerald-400">{metrics.memPct.toFixed(1)}%</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-amber-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Clock className="w-6 h-6 text-amber-500 mb-2" />
            <span className="text-slate-400 text-sm mb-1">Inference Latency</span>
            <span className="text-3xl font-mono text-slate-100">{metrics.latency} <span className="text-lg text-slate-500">ms</span></span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-purple-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Zap className="w-6 h-6 text-purple-500 mb-2" />
            <span className="text-slate-400 text-sm mb-1">Processing FPS</span>
            <span className="text-3xl font-mono text-purple-400">{metrics.fps.toFixed(1)}</span>
          </div>

        </div>

      </div>

    </div>
  );
}
