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
    <div className="flex-1 overflow-y-auto min-h-0 w-full space-y-4">

      {/* Feasibility cards */}
      <div className="flex flex-col md:flex-row gap-4">
        {feasibility.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="bg-radial from-transparent from-25% to-primary/10 to-100% border border-border rounded-3xl p-4 space-y-3 flex-1">
              <div className="flex items-center gap-2.5">
                <Icon className="w-5 h-5 text-foreground/60" strokeWidth={1.5} />
                <div className="text-foreground">{item.title}</div>
              </div>
              <div className="text-muted-foreground text-sm leading-relaxed">{item.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Challenges + Strategies */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* Challenges */}
        <div className="flex-1 bg-radial from-transparent from-25% to-primary/10 to-100% border border-border rounded-3xl p-4 space-y-6">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-muted-foreground/60" strokeWidth={1.5} />
            <div className="text-foreground">Potential Challenges</div>
          </div>
          <div className="flex flex-col gap-5">
            {challenges.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-muted-foreground/60" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-foreground/90 text-sm mb-1">{item.title}</div>
                    <div className="text-muted-foreground text-sm leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strategies */}
        <div className="flex-1 bg-radial from-transparent from-25% to-primary/10 to-100% border border-border rounded-3xl p-4 space-y-6">
          <div className="flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-muted-foreground/60" strokeWidth={1.5} />
            <div className="text-foreground">Strategies to Overcome</div>
          </div>
          <div className="space-y-4">
            {strategies.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-muted-foreground/60" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-foreground/90 text-sm mb-1">{item.title}</div>
                    <div className="text-muted-foreground text-sm leading-relaxed">{item.desc}</div>
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
