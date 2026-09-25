'use client';

import {
  Radar, BrainCircuit, Target, Layers, Box, Zap,
  Cpu, ShieldAlert, Eye, Maximize, Lightbulb, Rocket,
  Sparkles, Database, Network, Blocks, Infinity, Radio
} from 'lucide-react';

export default function ProposedSolution() {
  const explanation = [
    { icon: Radar, title: 'LiDAR Data Acquisition', desc: 'Collect LiDAR point clouds and vehicle trajectory data from SemanticKITTI.' },
    { icon: BrainCircuit, title: 'Semantic AI', desc: 'Classify points into road, vehicles, pedestrians, vegetation, buildings, etc.' },
    { icon: Target, title: 'Foveated Mapping', desc: 'Apply distance-based grids from 5 cm to 50 cm, keeping high detail nearby.' },
    { icon: Layers, title: '2.5D Representation', desc: 'Store semantic labels, ground elevation, object height and terrain information efficiently.' },
    { icon: Box, title: 'Object Detection', desc: 'Use DBSCAN to cluster dynamic objects and generate 3D bounding boxes.' },
    { icon: Zap, title: 'Real-Time Output', desc: 'Compress processed data using binary serialization and stream it through WebSocket for live visualization.' }
  ];

  const addresses = [
    { icon: Cpu, title: 'Reduces Computation', desc: 'Replaces dense 3D mapping with a variable-resolution 2.5D grid, reducing unnecessary processing and memory usage.' },
    { icon: ShieldAlert, title: 'Preserves Safety-Critical Detail', desc: 'Maintains 5 cm resolution within 10 m for accurate perception of nearby curbs, potholes and obstacles.' },
    { icon: Eye, title: 'Maintains Long-Range Awareness', desc: 'Gradually increases resolution up to 50 cm at 100 m, retaining distant scene information at lower cost.' },
    { icon: Maximize, title: 'Preserves Height Information', desc: 'Stores elevation and object-height data, overcoming the limitations of conventional 2D occupancy grids.' },
    { icon: Lightbulb, title: 'Enables Intelligent Perception', desc: 'Uses deep-learning semantic segmentation to distinguish terrain, static obstacles and dynamic objects.' },
    { icon: Rocket, title: 'Supports Real-Time Navigation', desc: 'Combines adaptive mapping, object extraction and efficient streaming for faster visualization and decision-making.' }
  ];

  const innovation = [
    { icon: Sparkles, title: 'Semantic-Aware Foveation', desc: 'Resolution adapts based on distance and semantic importance, preserving critical nearby objects.' },
    { icon: Database, title: 'Rich 2.5D Representation', desc: 'Each cell combines semantic labels, elevation, object height and terrain information.' },
    { icon: Network, title: 'Information-Preserving Mapping', desc: 'Majority voting + elevation statistics reduce data while retaining important scene information.' },
    { icon: Blocks, title: 'Model-Agnostic Design', desc: 'Supports PointNet++, Cylinder3D and MinkUNet without changing the mapping framework.' },
    { icon: Infinity, title: 'End-to-End Integration', desc: 'Combines semantic perception → adaptive mapping → object extraction → visualization in one pipeline.' },
    { icon: Radio, title: 'Efficient Real-Time Streaming', desc: 'Binary serialization + WebSocket communication enables lightweight transfer and visualization.' }
  ];

  const columns = [
    { title: 'Detailed Explanation', items: explanation },
    { title: 'How It Addresses the Problem?', items: addresses },
    { title: 'Innovation & Uniqueness', items: innovation },
  ];

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto py-8">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {columns.map((column, colIdx) => (
          <div key={colIdx} className="bg-radial from-transparent from-25% to-primary/10 to-100% backdrop-blur-xs border rounded-4xl">
            <div className="text-primary border-b border-border/50 px-5 py-3">
              {column.title}
            </div>
            <div className="space-y-6 p-6">
              {column.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex gap-4 group">
                    <div>
                      <h4 className="text-foreground text-sm mb-2 flex items-center gap-2">
                        <Icon className="w-4 h-4 text-primary" />
                        <span>{item.title}</span>
                      </h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
