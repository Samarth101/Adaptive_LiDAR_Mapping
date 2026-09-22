'use client';

import React, { useState } from 'react';
import { Database, Filter, Brain, Target, BoxSelect, MonitorPlay } from 'lucide-react';

export default function TechnicalMethodology() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const methodology = [
    { 
      id: 1, 
      icon: Database, 
      title: 'Data Acquisition', 
      desc: 'Acquire LiDAR scans and vehicle trajectory/odometry data.',
      tech: ['Python', 'PyTorch']
    },
    { 
      id: 2, 
      icon: Filter, 
      title: 'Preprocessing', 
      desc: 'Load and sequence LiDAR frames for processing.',
      tech: ['Python']
    },
    { 
      id: 3, 
      icon: Brain, 
      title: 'Semantic Segmentation', 
      desc: 'Classify LiDAR points using PointNet++, Cylinder3D or MinkUNet.',
      tech: ['Python', 'PyTorch', 'PointNet++', 'Cylinder3D', 'MinkUNet']
    },
    { 
      id: 4, 
      icon: Target, 
      title: 'Foveated Mapping', 
      desc: 'Convert points into adaptive 2.5D grids with 5–50 cm resolution based on distance.',
      tech: ['Python']
    },
    { 
      id: 5, 
      icon: BoxSelect, 
      title: 'Object & Elevation Extraction', 
      desc: 'Apply majority-vote semantics, elevation analysis and DBSCAN for 3D object detection.',
      tech: ['DBSCAN', 'RANSAC']
    },
    { 
      id: 6, 
      icon: MonitorPlay, 
      title: 'Streaming & Visualization', 
      desc: 'Serialize data into binary packets and stream via WebSocket to real-time 3D, semantic and elevation maps.',
      tech: ['FastAPI', 'WebSocket', 'Next.js', 'deck.gl', 'Three.js']
    }
  ];

  const techStack = [
    { category: 'Languages & Frameworks', items: ['Python', 'Next.js', 'FastAPI'] },
    { category: 'AI & Models', items: ['PyTorch', 'PointNet++', 'Cylinder3D', 'MinkUNet'] },
    { category: 'Algorithms', items: ['DBSCAN', 'RANSAC'] },
    { category: 'Visualization & Comms', items: ['WebSocket', 'deck.gl', 'Three.js'] }
  ];

  const getActiveTechs = () => {
    if (activeStep === null) return [];
    return methodology.find(s => s.id === activeStep)?.tech || [];
  };

  const activeTechs = getActiveTechs();

  return (
    <div className="flex-1 bg-background rounded-xl border border-border flex flex-col md:flex-row overflow-hidden relative">
      
      {/* Left Panel: Methodology */}
      <div className="w-full md:w-3/5 bg-card p-6 border-b md:border-b-0 md:border-r border-border overflow-y-auto">
        <h3 className="text-foreground mb-6 text-lg">Methodology</h3>
        
        <div className="space-y-4">
          {methodology.map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            return (
              <div 
                key={step.id}
                className={`flex gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                  isActive ? 'bg-primary/10 border-primary/30 shadow-sm' : 'bg-background border-border hover:border-primary/20'
                }`}
                onMouseEnter={() => setActiveStep(step.id)}
                onMouseLeave={() => setActiveStep(null)}
              >
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-primary/5 text-primary border-primary/20'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className={`text-sm mb-1 transition-colors ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    Step {step.id} — {step.title}
                  </h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Panel: Tech Stack */}
      <div className="w-full md:w-2/5 p-6 flex flex-col justify-center bg-background/50 relative overflow-hidden">
        
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative z-10">
          <h3 className="text-foreground mb-6 text-lg">Technology Stack</h3>
          
          <div className="space-y-6">
            {techStack.map((group) => (
              <div key={group.category}>
                <h4 className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-3">
                  {group.category}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((tech) => {
                    const isHighlighted = activeStep !== null && activeTechs.includes(tech);
                    const isDimmed = activeStep !== null && !activeTechs.includes(tech);
                    
                    return (
                      <span 
                        key={tech}
                        className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all duration-300 border ${
                          isHighlighted 
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-105' 
                            : isDimmed 
                              ? 'bg-card text-muted-foreground/40 border-border/50 scale-95' 
                              : 'bg-card text-foreground border-border hover:border-primary/30'
                        }`}
                      >
                        {tech}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 p-4 rounded-lg bg-card border border-border/50 text-xs text-muted-foreground text-center">
            Hover over any methodology step to highlight the technologies used.
          </div>
        </div>
      </div>
      
    </div>
  );
}
