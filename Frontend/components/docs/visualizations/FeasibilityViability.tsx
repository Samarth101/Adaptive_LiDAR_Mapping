'use client';

import React from 'react';
import { 
  CheckCircle2, 
  Activity, 
  Server, 
  AlertTriangle, 
  EyeOff, 
  Clock, 
  Settings, 
  Save, 
  Zap 
} from 'lucide-react';

export default function FeasibilityViability() {
  const feasibility = [
    { 
      icon: CheckCircle2, 
      title: 'Technical Feasibility', 
      desc: 'Uses established technologies such as SemanticKITTI, Cylinder3D / MinkUNet, adaptive grid mapping, DBSCAN and WebSocket streaming, making the solution technically implementable.' 
    },
    { 
      icon: Activity, 
      title: 'Computational Feasibility', 
      desc: 'The variable-resolution 2.5D representation reduces unnecessary processing and memory usage by focusing detail only where needed.' 
    },
    { 
      icon: Server, 
      title: 'Deployment Feasibility', 
      desc: 'The modular pipeline (AI → adaptive mapping → object extraction → visualization) can be deployed on GPU-enabled systems and scaled for real-time autonomous perception.' 
    }
  ];

  const challenges = [
    {
      icon: AlertTriangle,
      title: 'Computational Load',
      desc: 'Processing large LiDAR point clouds and deep-learning segmentation models can require significant GPU memory and processing power.'
    },
    {
      icon: EyeOff,
      title: 'Resolution & Information Trade-off',
      desc: 'Increasing cell size with distance may lead to loss of small or distant objects and reduced spatial precision.'
    },
    {
      icon: Clock,
      title: 'Real-Time Performance',
      desc: 'Maintaining accurate segmentation, adaptive mapping and object detection while achieving low latency can be challenging.'
    }
  ];

  const strategies = [
    {
      icon: Settings,
      title: 'Adaptive Processing',
      desc: 'Apply fine resolution only to safety-critical regions while using coarser cells for distant areas to reduce computation.'
    },
    {
      icon: Save,
      title: 'Information-Preserving Mapping',
      desc: 'Use semantic majority voting and elevation/height statistics to retain important information during 3D-to-2.5D conversion.'
    },
    {
      icon: Zap,
      title: 'Optimized Pipeline & Streaming',
      desc: 'Use GPU acceleration, vectorized processing, binary serialization and WebSocket communication to minimize processing and data-transfer latency.'
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto px-4 py-8 space-y-12">
      
      {/* Feasibility Section */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {feasibility.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="bg-card border border-border rounded-xl p-6 shadow-sm hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <Icon className="w-5 h-5 text-primary" />
                  <h3 className="text-foreground font-medium text-sm">{item.title}</h3>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Challenges Section */}
        <div className="bg-card/50 border border-border rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center border border-destructive/20">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <h2 className="text-xl text-foreground">Potential Challenges</h2>
          </div>
          
          <div className="space-y-6">
            {challenges.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex gap-4">
                  <div className="shrink-0 mt-1">
                    <Icon className="w-4 h-4 text-destructive/70" />
                  </div>
                  <div>
                    <h4 className="text-foreground text-sm mb-1">{item.title}</h4>
                    <p className="text-muted-foreground text-xs leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strategies Section */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl text-foreground">Strategies to Overcome</h2>
          </div>
          
          <div className="space-y-6">
            {strategies.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex gap-4">
                  <div className="shrink-0 mt-1">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-foreground text-sm mb-1">{item.title}</h4>
                    <p className="text-muted-foreground text-xs leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
