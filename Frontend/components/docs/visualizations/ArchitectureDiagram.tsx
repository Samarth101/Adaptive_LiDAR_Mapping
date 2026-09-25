'use client';

import React from 'react';
import {
  Database, FileText, Binary, Settings, Box, Map, Layers,
  Network, Hexagon, Component, LayoutGrid, Cpu,
  Radio, Monitor, ArrowRight, Activity, LucideIcon
} from 'lucide-react';

const Node = ({
  icon: Icon,
  title,
  subtitle,
  className = ""
}: {
  icon: LucideIcon,
  title: string,
  subtitle: string,
  className?: string
}) => (
  <div className={`bg-background/50 border border-border/60 rounded-xl p-3 flex flex-col items-center text-center gap-2 w-full lg:min-w-[200px] ${className}`}>
    <div className="text-primary p-2 bg-primary/10 rounded-lg shrink-0">
      <Icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={1.5} />
    </div>
    <div>
      <div className="text-xs md:text-[13px] font-medium text-foreground leading-tight mb-1">{title}</div>
      <div className="text-[10px] text-muted-foreground leading-tight px-1">{subtitle}</div>
    </div>
  </div>
);

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => {
  return (
    <div className="bg-radial from-transparent from-25% to-primary/7 to-100% backdrop-blur-xs border rounded-4xl overflow-hidden">
      <div className="text-primary border-b border-border/50 px-5 py-3">
        {title}
      </div>
      <div className="p-2 flex-1 space-y-2 justify-center items-center shrink-0">
        {children}
      </div>
    </div>
  );
}

type DiagramNode = {
  icon?: LucideIcon;
  title?: string;
  subtitle?: string;
  wrapperClass?: string;
  isSeparator?: boolean;
  isGrid?: boolean;
  gridNodes?: DiagramNode[];
};

type DiagramSection = {
  title: string;
  nodes: DiagramNode[];
};

type DiagramColumn = {
  id: string;
  sections: DiagramSection[];
};

const architectureData: DiagramColumn[] = [
  {
    id: "col-1",
    sections: [
      {
        title: "Data Acquisition",
        nodes: [
          { icon: Database, title: "SemanticKITTI Dataset", subtitle: "Velodyne .bin Scans" },
          { icon: FileText, title: "Vehicle Trajectory", subtitle: "poses.txt & Odometry" },
          { icon: Binary, title: "Binary Protocol Deserializer", subtitle: "ArrayBuffer", wrapperClass: "w-full mt-2 lg:mt-8" }
        ]
      }
    ]
  },
  {
    id: "col-2",
    sections: [
      {
        title: "Preprocessing & Mapping",
        nodes: [
          { icon: Settings, title: "Data Loader & Frame Sequencer", subtitle: "Ingestion and sequencing of raw data" },
          { isSeparator: true },
          { icon: Box, title: "Live 3D Point Cloud", subtitle: "Three.js & R3F" },
          { icon: Map, title: "2.5D Semantic Map", subtitle: "HTML5 2D Canvas" },
          { icon: Layers, title: "3D Elevation Map", subtitle: "Deck.gl + MapLibre" },
          { icon: Activity, title: "HUD & Metrics", subtitle: "Savings % & Object Counts" }
        ]
      }
    ]
  },
  {
    id: "col-3",
    sections: [
      {
        title: "Semantic AI",
        nodes: [
          { icon: Network, title: "PointNet++", subtitle: "Baseline / MPS / CPU / CUDA model" },
          { icon: Hexagon, title: "Cylinder3D", subtitle: "Cylindrical Voxel / CUDA model" },
          { icon: Component, title: "MinkUNet", subtitle: "Sparse Tensor / CUDA model" }
        ]
      }
    ]
  },
  {
    id: "col-4",
    sections: [
      {
        title: "Adaptive Learning",
        nodes: [
          { icon: LayoutGrid, title: "Adaptive Grid Engine", subtitle: "Vectorized Foveated Rings" },
          { icon: Cpu, title: "DBSCAN Clustering", subtitle: "3D Bounding Boxes" }
        ]
      },
      {
        title: "Output & Streaming",
        nodes: [
          {
            isGrid: true,
            gridNodes: [
              { icon: Binary, title: "Binary Frame V1 Serializer", subtitle: "C-struct Pack" },
              { icon: Layers, title: "Elevation & RANSAC", subtitle: "Ground Separation" }
            ]
          },
          { icon: Radio, title: "WebSocket Server", subtitle: "Port 8000 Non-blocking Async ThreadPool" },
          { icon: Monitor, title: "Session Controller", subtitle: "Model / Seq / Connect" }
        ]
      }
    ]
  }
];

export default function ArchitectureDiagram() {
  return (
    <div className="flex-1 rounded-4xl overflow-hidden relative border p-2 md:p-4">

      {/* Background grid */}
      <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"></div>

      <div className="relative z-10 h-full overflow-hidden flex flex-col">

        <div className="p-1 shrink-0 mb-4">
          <div className="text-lg font-medium text-foreground">System Architecture</div>
          <div className="text-muted-foreground text-sm max-w-3xl mt-1">
            Complete data flow from raw LiDAR ingestion to realtime rendering.
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 rounded-2xl">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch justify-start p-1 lg:overflow-x-auto">

            {architectureData.map((col, colIndex) => (
              <React.Fragment key={col.id}>
                {/* Column */}
                <div className="flex flex-col gap-4 shrink-0 w-full lg:w-fit">
                  {col.sections.map((section, secIndex) => (
                    <Section key={secIndex} title={section.title}>
                      {section.nodes.map((node, nodeIndex) => {
                        if (node.isSeparator) {
                          return <div key={nodeIndex} className="w-full border-t my-3"></div>;
                        }

                        if (node.isGrid && node.gridNodes) {
                          return (
                            <div key={nodeIndex} className="grid grid-cols-2 gap-2 w-full min-w-[280px]">
                              {node.gridNodes.map((gridNode, gIndex) => (
                                <Node key={gIndex} icon={gridNode.icon!} title={gridNode.title!} subtitle={gridNode.subtitle!} className="lg:min-w-0" />
                              ))}
                            </div>
                          );
                        }

                        const NodeComponent = <Node icon={node.icon!} title={node.title!} subtitle={node.subtitle!} />;

                        return node.wrapperClass ? (
                          <div key={nodeIndex} className={node.wrapperClass}>
                            {NodeComponent}
                          </div>
                        ) : (
                          <React.Fragment key={nodeIndex}>{NodeComponent}</React.Fragment>
                        );
                      })}
                    </Section>
                  ))}
                </div>

                {/* Arrows between columns */}
                {colIndex < architectureData.length - 1 && (
                  <>
                    <div className="hidden lg:block h-fit shrink-0 pt-4">
                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                    {/* Down arrow for mobile */}
                    <div className="flex lg:hidden items-center justify-center shrink-0 py-1">
                      <ArrowRight className="w-5 h-5 text-muted-foreground rotate-90" />
                    </div>
                  </>
                )}
              </React.Fragment>
            ))}

          </div>
        </div>
      </div>
    </div>
  );
}
