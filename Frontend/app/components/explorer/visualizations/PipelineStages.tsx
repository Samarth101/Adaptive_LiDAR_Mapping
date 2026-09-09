'use client';

import React, { useState } from 'react';
import { Network, Palette, BoxSelect, Mountain } from 'lucide-react';

export default function PipelineStages() {
  const [activeStage, setActiveStage] = useState(1);

  const stages = [
    { id: 1, name: 'Raw Points', icon: Network, desc: '124,668 unclassified XYZ coordinate returns from the LiDAR sensor.' },
    { id: 2, name: 'Semantic Segmentation', icon: Palette, desc: 'Deep learning (PointNet++) assigns a class label to every point.' },
    { id: 3, name: 'DBSCAN Clustering', icon: BoxSelect, desc: 'Dynamic semantic points are spatially clustered to detect 3D objects.' },
    { id: 4, name: 'Elevation Map', icon: Mountain, desc: 'Clusters are collapsed onto a 2.5D terrain grid, yielding the final map.' }
  ];

  return (
    <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl relative">
      
      {/* Top Navigation Bar */}
      <div className="flex w-full bg-slate-900 border-b border-slate-800">
        {stages.map((stage) => {
          const Icon = stage.icon;
          const isActive = activeStage === stage.id;
          return (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage.id)}
              className={`flex-1 p-4 flex flex-col items-center justify-center transition-all duration-300 border-b-2 ${
                isActive ? 'border-cyan-500 bg-cyan-500/5 text-cyan-400' : 'border-transparent text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
              }`}
            >
              <Icon className="w-6 h-6 mb-2" />
              <span className="font-bold text-sm">Stage {stage.id}</span>
              <span className="text-xs mt-1 text-center max-w-[120px] leading-tight">{stage.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Visualization Area */}
      <div className="flex-1 relative flex items-center justify-center bg-[#020617] overflow-hidden p-8">
        
        {/* Info Box */}
        <div className="absolute top-6 left-6 z-20 max-w-sm">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-5 rounded-lg shadow-xl">
            <h4 className="text-cyan-400 font-bold mb-2">{stages[activeStage - 1].name}</h4>
            <p className="text-slate-300 text-sm">{stages[activeStage - 1].desc}</p>
          </div>
        </div>

        {/* Abstract Visualization container */}
        <div className="relative w-full max-w-3xl aspect-video rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-center perspective-[1000px]">
          
          <div className={`relative w-96 h-96 transition-all duration-700 transform-style-3d ${
            activeStage >= 4 ? 'rotate-x-60 scale-y-50' : 'rotate-x-0'
          }`}>
            
            {/* Base grid that appears in stage 4 */}
            <div className={`absolute inset-0 border border-slate-700 bg-slate-950 transition-opacity duration-1000 ${
              activeStage >= 4 ? 'opacity-100' : 'opacity-0'
            }`} style={{ backgroundSize: '20px 20px', backgroundImage: 'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)' }} />

            {/* Simulated Point Cloud / Objects */}
            {/* Object 1: Car */}
            <div className={`absolute top-1/4 left-1/4 w-32 h-20 transition-all duration-1000 flex items-center justify-center ${
              activeStage === 1 ? 'border-none' : 
              activeStage === 2 ? 'border-none' : 
              'border-2 border-sky-500 bg-sky-500/20'
            }`}>
              {/* Points inside */}
              <div className="flex flex-wrap gap-1 p-2 w-full h-full justify-center content-center opacity-80">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors duration-1000 ${
                    activeStage === 1 ? 'bg-slate-400' : 'bg-sky-400'
                  }`} />
                ))}
              </div>
              
              {activeStage >= 3 && (
                <div className="absolute -top-6 bg-sky-500 text-white text-[10px] px-2 py-0.5 rounded font-bold shadow-lg">
                  CAR [ID: 3]
                </div>
              )}
            </div>

            {/* Object 2: Pedestrian */}
            <div className={`absolute top-1/2 left-2/3 w-12 h-12 transition-all duration-1000 flex items-center justify-center ${
              activeStage === 1 ? 'border-none' : 
              activeStage === 2 ? 'border-none' : 
              'border-2 border-pink-500 bg-pink-500/20 rounded-full'
            }`}>
              <div className="flex flex-wrap gap-1 p-1 w-full h-full justify-center content-center opacity-80">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={`w-1 h-1 rounded-full transition-colors duration-1000 ${
                    activeStage === 1 ? 'bg-slate-400' : 'bg-pink-400'
                  }`} />
                ))}
              </div>
            </div>

            {/* Noise / Terrain points */}
            <div className="absolute inset-0 pointer-events-none">
               <div className={`absolute bottom-10 left-10 w-4 h-4 rounded-full transition-colors duration-1000 ${
                  activeStage === 1 ? 'bg-slate-500' : 'bg-emerald-500'
               }`} />
               <div className={`absolute bottom-16 left-20 w-3 h-3 rounded-full transition-colors duration-1000 ${
                  activeStage === 1 ? 'bg-slate-500' : 'bg-emerald-500'
               }`} />
               <div className={`absolute top-10 right-10 w-5 h-5 rounded-full transition-colors duration-1000 ${
                  activeStage === 1 ? 'bg-slate-500' : 'bg-purple-500'
               }`} />
            </div>

            {/* Elevation blocks (Stage 4) */}
            {activeStage >= 4 && (
              <>
                <div className="absolute bottom-8 left-8 w-10 h-16 bg-emerald-500/30 border border-emerald-500 transform -translate-y-8 animate-fade-in" />
                <div className="absolute bottom-12 left-16 w-10 h-24 bg-emerald-500/40 border border-emerald-500 transform -translate-y-12 animate-fade-in" />
              </>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
