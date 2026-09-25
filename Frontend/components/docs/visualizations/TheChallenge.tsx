'use client';

import React from 'react';
import { Scan, Car, Grid3X3 } from 'lucide-react';

export default function TheChallenge() {
  const tasks = [
    {
      icon: Scan,
      title: 'Terrain Analysis',
      desc: 'Distinguish drivable surfaces (roads, parking) from non-drivable terrain (sidewalks, vegetation, obstacles).',
    },
    {
      icon: Car,
      title: 'Object Detection',
      desc: 'Identify and classify static obstacles (walls, poles, buildings) and dynamic objects (pedestrians, vehicles, cyclists).',
    },
    {
      icon: Grid3X3,
      title: 'Adaptive Representation',
      desc: 'Implement a non-uniform spatial grid where cell resolution decreases with distance — high detail nearby, coarser far away.',
    },
  ];

  const stats = [
    { value: '1M+', label: 'points per scan' },
    { value: '100 m', label: 'sensing radius' },
    { value: '20+', label: 'semantic classes' },
    { value: '5-50 cm', label: 'adaptive resolution' },
  ];

  return (
    <div className="flex-1 flex flex-col justify-center relative overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:50px_50px]" />

      <div className="relative z-10 w-full h-full p-3 md:p-6">
        {/* Title */}
        <div className="text-2xl text-foreground mb-6">
          Adaptive Variable Resolution 2.5D LiDAR Mapping
        </div>
        <p className="text-muted-foreground leading-relaxed mb-8 max-w-150 p-2">
          Autonomous navigation demands that a vehicle perceive its surroundings in real time. 3D LiDAR point clouds provide rich spatial data, but processing millions of points creates computational bottlenecks. Standard 2D occupancy grids lose the height information needed to detect curbs, potholes, or overhanging obstacles. We need a middle ground — a foveated approach, like human vision, where the immediate vicinity is rendered in high detail and distant areas are simplified.
        </p>

        {/* Three task cards */}
        <div className="bg-radial from-transparent from-25% to-primary/10 to-100% backdrop-blur-xs border rounded-t-4xl rounded-b-xl grid grid-cols-1 lg:grid-cols-3 gap-6 mb-3 p-6">
          {tasks.map((task) => {
            const Icon = task.icon;
            return (
              <div
                key={task.title}
                className="flex flex-col gap-3"
              >
                <Icon className="w-6 h-6 text-primary" />
                <div>
                  <div className="text-foreground mb-2">{task.title}</div>
                  <p className="text-muted-foreground leading-relaxed">{task.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Key numbers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`bg-radial from-transparent from-15% to-primary/10 to-100% backdrop-blur-xs border rounded-xl px-4 py-3 text-center ${i === 0 && 'rounded-bl-4xl'} ${i === stats.length - 1 && 'rounded-br-4xl'}`}
            >
              <div className="text-foreground font-mono text-lg">{stat.value}</div>
              <div className="text-muted-foreground text-xs mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
