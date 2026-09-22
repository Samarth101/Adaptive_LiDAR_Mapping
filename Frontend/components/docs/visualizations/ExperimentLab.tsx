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
    <div className="flex-1 bg-background rounded-xl border border-border flex overflow-hidden relative">
      
      {/* Sidebar Controls */}
      <div className="w-1/3 bg-card border-r border-border p-6 flex flex-col relative z-10">
        <h3 className="text-foreground flex items-center gap-2 mb-6">
          <Settings2 className="w-5 h-5 text-primary" /> Pipeline Parameters
        </h3>

        <div className="space-y-6">
          <div>
            <label className="text-xs text-muted-foreground/70 tracking-normal mb-2 block">Spatial Resolution</label>
            <div className="flex bg-background rounded-lg p-1 border border-border">
              <button 
                onClick={() => setUseAdaptive(false)}
                className={`flex-1 py-2 text-sm rounded transition-all ${!useAdaptive ? 'bg-muted text-foreground' : 'text-muted-foreground/70 hover:text-muted-foreground'}`}
              >
                Uniform (5cm)
              </button>
              <button 
                onClick={() => setUseAdaptive(true)}
                className={`flex-1 py-2 text-sm rounded transition-all ${useAdaptive ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground/70 hover:text-muted-foreground'}`}
              >
                Foveated Adaptive
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground/70 tracking-normal mb-2 block">Semantic Model</label>
            <div className="flex flex-col gap-1 bg-background rounded-lg p-1 border border-border">
              <button onClick={() => setModel('pointnet2')} className={`py-2 px-3 text-left text-sm rounded transition-all ${model === 'pointnet2' ? 'bg-muted text-foreground' : 'text-muted-foreground/70 hover:text-muted-foreground'}`}>PointNet++ (Baseline)</button>
              <button onClick={() => setModel('minkunet')} className={`py-2 px-3 text-left text-sm rounded transition-all ${model === 'minkunet' ? 'bg-muted text-foreground' : 'text-muted-foreground/70 hover:text-muted-foreground'}`}>MinkUNet (Sparse)</button>
              <button onClick={() => setModel('cylinder3d')} className={`py-2 px-3 text-left text-sm rounded transition-all ${model === 'cylinder3d' ? 'bg-muted text-foreground' : 'text-muted-foreground/70 hover:text-muted-foreground'}`}>Cylinder3D (High Acc)</button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground/70 tracking-normal mb-2 block">Object Detection</label>
            <button 
              onClick={() => setUseDBSCAN(!useDBSCAN)}
              className={`w-full py-2 text-sm rounded transition-all border ${useDBSCAN ? 'bg-primary/10 text-primary border-primary/20' : 'bg-background text-muted-foreground/70 border-border hover:text-muted-foreground'}`}
            >
              {useDBSCAN ? 'DBSCAN Enabled' : 'DBSCAN Disabled'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Dashboard Display */}
      <div className="w-2/3 bg-background p-8 flex flex-col justify-center">
        
        <h4 className="text-foreground mb-8 text-center">Performance Evidence</h4>

        <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto w-full">
          
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Database className="w-6 h-6 text-primary mb-2" />
            <span className="text-muted-foreground text-sm mb-1">Spatial Elements</span>
            <span className="text-3xl font-mono text-foreground">{metrics.cells.toLocaleString()}</span>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
             <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Zap className="w-6 h-6 text-primary mb-2" />
            <span className="text-muted-foreground text-sm mb-1">Memory Savings</span>
            <span className="text-3xl font-mono text-primary">{metrics.memPct.toFixed(1)}%</span>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Clock className="w-6 h-6 text-muted-foreground mb-2" />
            <span className="text-muted-foreground text-sm mb-1">Inference Latency</span>
            <span className="text-3xl font-mono text-foreground">{metrics.latency} <span className="text-lg text-muted-foreground/70">ms</span></span>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Zap className="w-6 h-6 text-muted-foreground mb-2" />
            <span className="text-muted-foreground text-sm mb-1">Processing FPS</span>
            <span className="text-3xl font-mono text-foreground">{metrics.fps.toFixed(1)}</span>
          </div>

        </div>

        {/* Memory comparison bar */}
        <div className="max-w-2xl mx-auto w-full mt-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-3">Memory Usage Comparison</div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Uniform (all 5cm)</span>
                  <span className="font-mono">40,000 cells</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-foreground/30 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Adaptive (foveated)</span>
                  <span className="font-mono text-primary">484 cells</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: useAdaptive ? '1.2%' : '100%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Takeaway */}
        <div className="max-w-2xl mx-auto w-full mt-4">
          <p className="text-muted-foreground/70 text-xs text-center">
            Adaptive mapping reduces memory by 98.7% while maintaining classification accuracy, enabling real-time inference on edge hardware.
          </p>
        </div>

      </div>

    </div>
  );
}
