'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import RealityToPoints from '../components/explorer/visualizations/RealityToPoints';
import RepresentationCompare from '../components/explorer/visualizations/RepresentationCompare';
import UniformVsAdaptive from '../components/explorer/visualizations/UniformVsAdaptive';

import CellInspector from '../components/explorer/visualizations/CellInspector';
import PipelineStages from '../components/explorer/visualizations/PipelineStages';
import ArchitectureDiagram from '../components/explorer/visualizations/ArchitectureDiagram';
import ExperimentLab from '../components/explorer/visualizations/ExperimentLab';

const sections = [
  { id: '01-sensor', title: '01 Sensor', label: 'From Reality to Points' },
  { id: '02-points', title: '02 Points', label: 'What Does LiDAR Actually Capture?' },
  { id: '03-represent', title: '03 3D/2D', label: 'Same Environment. Three Representations.' },
  { id: '04-problem', title: '04 Problem', label: 'Why Uniform Resolution Breaks Down' },
  { id: '05-adaptive', title: '05 Adaptive', label: 'Our Adaptive 2.5D Approach' },
  { id: '06-cell', title: '06 Cell', label: 'Inside One Adaptive Cell' },
  { id: '07-semantic', title: '07 Semantic', label: 'How Semantics Enter the Map' },
  { id: '08-pipeline', title: '08 Pipeline', label: 'From Points → Objects → Terrain' },
  { id: '09-foveated', title: '09 Foveated', label: 'Foveated LiDAR Mapping' },
  { id: '10-binary', title: '10 Binary', label: 'Live Architecture' },
  { id: '11-backend', title: '11 Backend', label: 'What Does the Backend Actually Receive?' },
  { id: '12-exper', title: '12 Exper.', label: 'Experiment Lab' },
];

export default function ExplorerPage() {
  const [activeSection, setActiveSection] = useState('01-sensor');
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    );

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sticky Navigation Rail */}
      <nav className="w-64 h-full bg-slate-900 border-r border-slate-800 flex flex-col pt-8 pb-4 px-4 flex-shrink-0 relative z-20 shadow-xl">
        <div className="mb-8 px-2">
          <Link href="/" className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold tracking-wider flex items-center transition-colors">
            ← BACK TO DASHBOARD
          </Link>
          <h1 className="text-2xl font-bold mt-4 tracking-tight">LumiGRID Explorer</h1>
          <p className="text-xs text-slate-400 mt-2">Interactive Architecture Lab</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {sections.map((section, idx) => {
            const isActive = activeSection === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`block px-3 py-2 rounded transition-all duration-200 border-l-2 ${
                  isActive 
                    ? 'border-cyan-400 bg-slate-800/50 text-cyan-50 font-medium translate-x-1' 
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <span className={`text-xs mr-2 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>
                  {section.title.split(' ')[0]}
                </span>
                <span className="text-sm">
                  {section.title.substring(section.title.indexOf(' ') + 1)}
                </span>
              </a>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto scroll-smooth">
        
        {/* 01 Sensor & 02 Points */}
        <section id="01-sensor" ref={(el) => { sectionRefs.current[0] = el; }} className="h-screen relative border-b border-slate-800/50 flex flex-col p-8">
          <h2 className="text-3xl font-bold mb-8 text-cyan-400">{sections[0].label}</h2>
          <RealityToPoints />
        </section>

        <section id="02-points" ref={(el) => { sectionRefs.current[1] = el; }} className="h-screen relative border-b border-slate-800/50 p-8 flex flex-col">
           <h2 className="text-3xl font-bold mb-8 text-cyan-400">{sections[1].label}</h2>
           <div className="flex-1 bg-slate-900 rounded flex items-center justify-center text-slate-500 border border-slate-800">
             [Interactive Sensor Anatomy Visualization]
           </div>
        </section>

        {/* 03 3D/2D */}
        <section id="03-represent" ref={(el) => { sectionRefs.current[2] = el; }} className="h-screen relative border-b border-slate-800/50 p-8 flex flex-col">
          <h2 className="text-3xl font-bold mb-8 text-cyan-400">{sections[2].label}</h2>
          <RepresentationCompare />
        </section>

        {/* 04 Problem & 05 Adaptive */}
        <section id="04-problem" ref={(el) => { sectionRefs.current[3] = el; }} className="h-screen relative border-b border-slate-800/50 p-8 flex flex-col">
          <h2 className="text-3xl font-bold mb-8 text-cyan-400">{sections[3].label}</h2>
          <UniformVsAdaptive />
        </section>

        <section id="05-adaptive" ref={(el) => { sectionRefs.current[4] = el; }} className="h-screen relative border-b border-slate-800/50 p-8 flex flex-col">
          <h2 className="text-3xl font-bold mb-8 text-cyan-400">{sections[4].label}</h2>
          <div className="flex-1 bg-slate-900 rounded flex items-center justify-center text-slate-500 border border-slate-800">
             [Foveated Radial Map Visualization]
          </div>
        </section>

        {/* 06 Cell & 07 Semantic */}
        <section id="06-cell" ref={(el) => { sectionRefs.current[5] = el; }} className="h-screen relative border-b border-slate-800/50 p-8 flex flex-col">
          <h2 className="text-3xl font-bold mb-8 text-cyan-400">{sections[5].label}</h2>
          <CellInspector />
        </section>

        <section id="07-semantic" ref={(el) => { sectionRefs.current[6] = el; }} className="h-screen relative border-b border-slate-800/50 p-8 flex flex-col">
          <h2 className="text-3xl font-bold mb-8 text-cyan-400">{sections[6].label}</h2>
          <div className="flex-1 bg-slate-900 rounded flex items-center justify-center text-slate-500 border border-slate-800">
             [Semantic Confidence Voting Visualization]
          </div>
        </section>

        {/* 08 Pipeline */}
        <section id="08-pipeline" ref={(el) => { sectionRefs.current[7] = el; }} className="h-screen relative border-b border-slate-800/50 p-8 flex flex-col">
          <h2 className="text-3xl font-bold mb-8 text-cyan-400">{sections[7].label}</h2>
          <PipelineStages />
        </section>

        {/* 09 Foveated */}
        <section id="09-foveated" ref={(el) => { sectionRefs.current[8] = el; }} className="h-screen relative border-b border-slate-800/50 p-8 flex flex-col">
          <h2 className="text-3xl font-bold mb-8 text-cyan-400">{sections[8].label}</h2>
          <div className="flex-1 bg-slate-900 rounded flex items-center justify-center text-slate-500 border border-slate-800">
             [Attention Cone & Future Extensions Visualization]
          </div>
        </section>

        {/* 10 Architecture & 11 Backend */}
        <section id="10-binary" ref={(el) => { sectionRefs.current[9] = el; }} className="h-screen relative border-b border-slate-800/50 p-8 flex flex-col">
          <h2 className="text-3xl font-bold mb-8 text-cyan-400">{sections[9].label}</h2>
          <ArchitectureDiagram />
        </section>

        <section id="11-backend" ref={(el) => { sectionRefs.current[10] = el; }} className="h-screen relative border-b border-slate-800/50 p-8 flex flex-col">
          <h2 className="text-3xl font-bold mb-8 text-cyan-400">{sections[10].label}</h2>
          <div className="flex-1 bg-slate-900 rounded flex items-center justify-center text-slate-500 border border-slate-800">
             [Binary Frame Hex Viewer Mockup]
          </div>
        </section>

        {/* 12 Experiment Lab */}
        <section id="12-exper" ref={(el) => { sectionRefs.current[11] = el; }} className="min-h-screen relative p-8 flex flex-col pb-32">
          <h2 className="text-3xl font-bold mb-8 text-cyan-400">{sections[11].label}</h2>
          <ExperimentLab />
        </section>

      </main>
    </div>
  );
}
