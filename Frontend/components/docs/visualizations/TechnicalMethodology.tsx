'use client';

import { useState } from 'react';
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
    <div className="flex-1 h-full min-h-0 rounded-4xl overflow-hidden relative border p-2 flex flex-col-reverse md:flex-row gap-2">

      {/* Left Panel: Methodology */}
      <div className="w-full grow bg-card/30 rounded-2xl p-4 overflow-y-auto">
        <div className="text-foreground text-lg mb-6">Methodology</div>

        <div className="flex flex-col gap-2">
          {methodology.map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer ${isActive ? 'bg-primary/10 border-primary/30' : 'bg-radial from-transparent from-25% to-primary/7 to-100%'
                  }`}
                onMouseEnter={() => setActiveStep(step.id)}
                onMouseLeave={() => setActiveStep(null)}
              >
                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary/15 text-primary">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className={`text-sm mb-0.5 transition-colors ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    Step {step.id} — {step.title}
                  </div>
                  <div className="text-muted-foreground text-xs leading-relaxed">{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Panel: Tech Stack */}
      <div className="w-full md:w-fit md:max-w-150 p-4 bg-radial from-transparent from-25% to-primary/5 to-100% rounded-2xl overflow-y-auto flex flex-col">
        <div className="text-foreground mb-6 text-lg text-base">
          Technology Stack
        </div>

        <div className="flex flex-col gap-6">
          {techStack.map((group) => (
            <div key={group.category}>
              <div className="text-sm text-muted-foreground/70 mb-2.5">
                {group.category}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.items.map((tech) => {
                  const isHighlighted = activeStep !== null && activeTechs.includes(tech);
                  const isDimmed = activeStep !== null && !activeTechs.includes(tech);

                  return (
                    <span
                      key={tech}
                      className={`px-2.5 py-1 rounded-full text-[13px] border ${isHighlighted
                        ? 'bg-primary text-primary-foreground border-primary'
                        : isDimmed
                          ? 'opacity-30'
                          : 'bg-card text-foreground border-border/60'
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

        <div className="mt-auto pt-6 text-sm italic text-muted-foreground/70">
          Hover over any methodology step to highlight the technologies used.
        </div>
      </div>

    </div>
  );
}
