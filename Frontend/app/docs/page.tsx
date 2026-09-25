'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { DocsAnimationContext } from '@/components/docs/DocsAnimationContext';

import TheChallenge from '@/components/docs/visualizations/TheChallenge';
import RealityToPoints from '@/components/docs/visualizations/RealityToPoints';
import RepresentationCompare from '@/components/docs/visualizations/RepresentationCompare';
import UniformVsAdaptive from '@/components/docs/visualizations/UniformVsAdaptive';
import PipelineStages from '@/components/docs/visualizations/PipelineStages';
import ArchitectureDiagram from '@/components/docs/visualizations/ArchitectureDiagram';
import ProposedSolution from '@/components/docs/visualizations/ProposedSolution';
import TechnicalMethodology from '@/components/docs/visualizations/TechnicalMethodology';
import FeasibilityViability from '@/components/docs/visualizations/FeasibilityViability';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';

const sections = [
  { id: '1', title: '01 Challenge', label: 'The Challenge' },
  { id: '2', title: '02 Overview', label: 'Proposed Solution' },
  { id: '3', title: '03 LiDAR', label: 'How LiDAR Sees the World' },
  { id: '4', title: '04 Why 2.5D', label: 'Why 2.5D?' },
  { id: '5', title: '05 Pipeline', label: 'The Processing Pipeline' },
  { id: '6', title: '06 Tech', label: 'Technical Approach' },
  { id: '7', title: '07 Feasibility', label: 'Feasibility & Viability' },
];

// Tab bar for sections with multiple views
function SectionTabs({ tabs, activeTab, onTabChange }: { tabs: string[], activeTab: number, onTabChange: (i: number) => void }) {
  return (
    <div className="flex bg-radial from-transparent from-25% to-primary/12 to-100% p-1 rounded-full border border-border w-fit">
      {tabs.map((tab, i) => (
        <button
          key={tab}
          onClick={() => onTabChange(i)}
          className={`px-5 py-1.5 rounded-full text-sm transition-all duration-200 ${activeTab === i
            ? 'bg-radial from-primary/80 from-10% to-primary to-100% text-primary-foreground'
            : 'text-foreground/80'
            }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export default function ExplorerPage() {
  const [activeSection, setActiveSection] = useState('1');
  const [isPaused, setIsPaused] = useState(true);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // Tab states for combined sections
  const [why25dTab, setWhy25dTab] = useState(0);
  const [pipelineTab, setPipelineTab] = useState(0);
  const [techTab, setTechTab] = useState(0);

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
      <div className={`flex flex-col md:flex-row h-screen w-full bg-background text-foreground overflow-hidden font-sans ${isPaused ? 'pause-animations' : ''}`}>

        {/* Global Animation Control & Header */}
        <div className="fixed top-3 right-3 w-fit z-50 pointer-events-none flex">
          <div className="bg-radial from-transparent from-25% to-primary/10 to-100% backdrop-blur-xs p-2 rounded-full flex items-center gap-2 border pointer-events-auto">
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

        {/* Navigation Rail — kept exactly as-is */}
        <nav className="p-3 md:pr-0 w-full md:w-68 h-auto md:h-full relative z-20">
          <Link
            href="/"
            className="bg-radial from-transparent from-25% to-primary/10 to-100% w-fit backdrop-blur-xs pl-4 pr-5 py-3 rounded-full flex items-center gap-2 border"
          >
            <ArrowLeft className="w-4.5 h-4.5 -mr-1 md:mr-2" />
            <span className='hidden md:block'>Back to dashboard</span>
          </Link>

          <div className="mt-4 bg-card/50 backdrop-blur-xs p-1.5 md:p-3 border rounded-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex md:flex-col space-x-2 md:space-x-0 md:space-y-2">
              {sections.map((section, _) => {
                const isActive = activeSection === section.id;
                return (
                  <Link
                    key={section.id}
                    href={`#${section.id}`}
                    className={`shrink-0 md:shrink-1 px-4 py-2.5 rounded-full duration-200 whitespace-nowrap truncate ${isActive
                      ? 'bg-radial from-primary/80 from-25% to-primary to-100% text-primary-foreground'
                      : 'text-muted-foreground bg-radial from-transparent from-25% to-primary/5 to-100%'
                      }`}
                  >
                    <span className={`mr-2 ${!isActive && 'text-muted-foreground/70'}`}>
                      {section.title.split(' ')[0]}
                    </span>
                    <span>
                      {section.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

        </nav>

        {/* Main Content Area */}
        <main className="flex-1 h-full overflow-y-auto space-y-10 scroll-smooth">

          {sections.map((section, index) => {
            return (
              <section
                key={section.id}
                id={section.id}
                ref={(el) => { sectionRefs.current[index] = el; }}
                className="relative flex flex-col p-4 md:p-6 min-h-screen"
              >
                {/* Headers and Tabs */}
                <div className="text-lg md:text-xl text-primary pb-3">
                  {section.label}
                </div>

                <div className="pb-3">
                  {section.id === '4' && (
                    <SectionTabs
                      tabs={['Representations', 'Uniform vs Adaptive']}
                      activeTab={why25dTab}
                      onTabChange={setWhy25dTab}
                    />
                  )}
                  {section.id === '6' && (
                    <SectionTabs
                      tabs={['System Architecture', 'Methodology & Stack']}
                      activeTab={techTab}
                      onTabChange={setTechTab}
                    />
                  )}
                </div>

                {/* Render Component */}
                {section.id === '1' && <TheChallenge />}
                {section.id === '2' && <ProposedSolution />}
                {section.id === '3' && <RealityToPoints />}
                {section.id === '4' && (why25dTab === 0 ? <RepresentationCompare /> : <UniformVsAdaptive />)}
                {section.id === '5' && <PipelineStages />}
                {section.id === '6' && (techTab === 0 ? <ArchitectureDiagram /> : <TechnicalMethodology />)}
                {section.id === '7' && <FeasibilityViability />}
              </section>
            );
          })}

          <div className="pb-8">
            <Footer />
          </div>

        </main>
      </div>
    </DocsAnimationContext.Provider>
  );
}
