'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Pause, Play, Home, ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { DocsAnimationContext } from '@/components/docs/DocsAnimationContext';
import RealityToPoints from '@/components/docs/visualizations/RealityToPoints';
import RepresentationCompare from '@/components/docs/visualizations/RepresentationCompare';
import UniformVsAdaptive from '@/components/docs/visualizations/UniformVsAdaptive';

import CellInspector from '@/components/docs/visualizations/CellInspector';
import PipelineStages from '@/components/docs/visualizations/PipelineStages';
import ArchitectureDiagram from '@/components/docs/visualizations/ArchitectureDiagram';
import ExperimentLab from '@/components/docs/visualizations/ExperimentLab';
import { Button } from '@/components/ui/button';

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
  const [isPaused, setIsPaused] = useState(false);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSections = entries.filter((entry) => entry.isIntersecting);
        if (visibleSections.length > 0) {
          setActiveSection(visibleSections[0].target.id);
        }
      },
      { rootMargin: '-40% 0px -50% 0px' }
    );

    sectionRefs.current.forEach((section) => {
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <DocsAnimationContext.Provider value={{ isPaused }}>
      <div className={`flex flex-col md:flex-row h-screen w-full bg-background text-foreground overflow-hidden font-sans font-normal ${isPaused ? 'pause-animations' : ''}`}>

        {/* Global Animation Control & Header */}
        <div className="fixed top-3 right-3 w-fit z-50 pointer-events-none flex">
          <div className="bg-card/50 backdrop-blur-xs p-2 rounded-full flex items-center gap-2 border pointer-events-auto">
            <ThemeToggle />

            <Button
              onClick={() => setIsPaused(!isPaused)}
              variant='default'
              className={"rounded-full px-3"}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
          </div>
        </div>

        {/* Navigation Rail */}
        <nav className="w-full md:w-64 h-auto md:h-full bg-card border-b md:border-b-0 md:border-r border-border flex flex-col p-4 flex-shrink-0 relative z-20 shadow-sm md:shadow-xl">
          <div className="mb-4 md:mb-8 px-2">
            <Link href="/" className="text-primary hover:opacity-80 text-sm font-normal flex items-center transition-opacity">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to dashboard
            </Link>
            <h1 className="text-lg md:text-xl font-normal mt-4">LumiGRID Explorer</h1>
            <p className="text-xs text-muted-foreground mt-1">Interactive architecture lab</p>
          </div>

          <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto space-x-2 md:space-x-0 md:space-y-1 pb-2 md:pb-0 hide-scrollbar">
            {sections.map((section, _) => {
              const isActive = activeSection === section.id;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className={`block px-3 py-2 rounded transition-all duration-200 md:border-l-2 whitespace-nowrap md:whitespace-normal flex-shrink-0 ${isActive
                    ? 'md:border-primary bg-muted text-foreground font-normal md:translate-x-1'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                >
                  <span className={`text-xs mr-2 ${isActive ? 'text-primary' : 'text-muted-foreground/70'}`}>
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
          <section id="01-sensor" ref={(el) => { sectionRefs.current[0] = el; }} className="h-screen relative border-b border-border flex flex-col p-4 md:p-8">
            <h2 className="text-lg md:text-xl font-normal mb-4 md:mb-8 text-primary">{sections[0].label}</h2>
            <RealityToPoints />
          </section>

          <section id="02-points" ref={(el) => { sectionRefs.current[1] = el; }} className="h-screen relative border-b border-border p-4 md:p-8 flex flex-col">
            <h2 className="text-lg md:text-xl font-normal mb-4 md:mb-8 text-primary">{sections[1].label}</h2>
            <div className="flex-1 bg-card rounded flex items-center justify-center text-muted-foreground border border-border text-sm">
              [Interactive sensor anatomy visualization]
            </div>
          </section>

          {/* 03 3D/2D */}
          <section id="03-represent" ref={(el) => { sectionRefs.current[2] = el; }} className="h-screen relative border-b border-border p-4 md:p-8 flex flex-col">
            <h2 className="text-lg md:text-xl font-normal mb-4 md:mb-8 text-primary">{sections[2].label}</h2>
            <RepresentationCompare />
          </section>

          {/* 04 Problem & 05 Adaptive */}
          <section id="04-problem" ref={(el) => { sectionRefs.current[3] = el; }} className="h-screen relative border-b border-border p-4 md:p-8 flex flex-col">
            <h2 className="text-lg md:text-xl font-normal mb-4 md:mb-8 text-primary">{sections[3].label}</h2>
            <UniformVsAdaptive />
          </section>

          <section id="05-adaptive" ref={(el) => { sectionRefs.current[4] = el; }} className="h-screen relative border-b border-border p-4 md:p-8 flex flex-col">
            <h2 className="text-lg md:text-xl font-normal mb-4 md:mb-8 text-primary">{sections[4].label}</h2>
            <div className="flex-1 bg-card rounded flex items-center justify-center text-muted-foreground border border-border text-sm">
              [Foveated radial map visualization]
            </div>
          </section>

          {/* 06 Cell & 07 Semantic */}
          <section id="06-cell" ref={(el) => { sectionRefs.current[5] = el; }} className="h-screen relative border-b border-border p-4 md:p-8 flex flex-col">
            <h2 className="text-lg md:text-xl font-normal mb-4 md:mb-8 text-primary">{sections[5].label}</h2>
            <CellInspector />
          </section>

          <section id="07-semantic" ref={(el) => { sectionRefs.current[6] = el; }} className="h-screen relative border-b border-border p-4 md:p-8 flex flex-col">
            <h2 className="text-lg md:text-xl font-normal mb-4 md:mb-8 text-primary">{sections[6].label}</h2>
            <div className="flex-1 bg-card rounded flex items-center justify-center text-muted-foreground border border-border text-sm">
              [Semantic confidence voting visualization]
            </div>
          </section>

          {/* 08 Pipeline */}
          <section id="08-pipeline" ref={(el) => { sectionRefs.current[7] = el; }} className="h-screen relative border-b border-border p-4 md:p-8 flex flex-col">
            <h2 className="text-lg md:text-xl font-normal mb-4 md:mb-8 text-primary">{sections[7].label}</h2>
            <PipelineStages />
          </section>

          {/* 09 Foveated */}
          <section id="09-foveated" ref={(el) => { sectionRefs.current[8] = el; }} className="h-screen relative border-b border-border p-4 md:p-8 flex flex-col">
            <h2 className="text-lg md:text-xl font-normal mb-4 md:mb-8 text-primary">{sections[8].label}</h2>
            <div className="flex-1 bg-card rounded flex items-center justify-center text-muted-foreground border border-border text-sm">
              [Attention cone & future extensions visualization]
            </div>
          </section>

          {/* 10 Architecture & 11 Backend */}
          <section id="10-binary" ref={(el) => { sectionRefs.current[9] = el; }} className="h-screen relative border-b border-border p-4 md:p-8 flex flex-col">
            <h2 className="text-lg md:text-xl font-normal mb-4 md:mb-8 text-primary">{sections[9].label}</h2>
            <ArchitectureDiagram />
          </section>

          <section id="11-backend" ref={(el) => { sectionRefs.current[10] = el; }} className="h-screen relative border-b border-border p-4 md:p-8 flex flex-col">
            <h2 className="text-lg md:text-xl font-normal mb-4 md:mb-8 text-primary">{sections[10].label}</h2>
            <div className="flex-1 bg-card rounded flex items-center justify-center text-muted-foreground border border-border text-sm">
              [Binary frame hex viewer mockup]
            </div>
          </section>

          {/* 12 Experiment Lab */}
          <section id="12-exper" ref={(el) => { sectionRefs.current[11] = el; }} className="min-h-screen relative p-4 md:p-8 flex flex-col pb-32">
            <h2 className="text-lg md:text-xl font-normal mb-4 md:mb-8 text-primary">{sections[11].label}</h2>
            <ExperimentLab />
          </section>

        </main>
      </div>
    </DocsAnimationContext.Provider>
  );
}
