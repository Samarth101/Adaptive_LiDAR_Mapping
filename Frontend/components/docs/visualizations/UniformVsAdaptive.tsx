'use client';

import { useState, useMemo } from 'react';
import { MousePointer2 } from 'lucide-react';

export default function UniformVsAdaptive() {
  const [mode, setMode] = useState<'uniform' | 'adaptive'>('uniform');
  const [hoveredCell, setHoveredCell] = useState<{ x: number, y: number, res: string } | null>(null);

  const center = { x: 200, y: 200 };

  // Calculate actual grid layouts and counts dynamically
  const { uniformCells, adaptiveCells } = useMemo(() => {
    // Generate Uniform Grid (12.5px cells representing 5cm resolution everywhere)
    const uCells = [];
    const step = 12.5;
    for (let x = 0; x < 400; x += step) {
      for (let y = 0; y < 400; y += step) {
        uCells.push({ x, y, size: step, res: '5 cm', stroke: 'stroke-primary/30' });
      }
    }

    // Generate Adaptive Grid using a Recursive Quadtree based on Radius
    const aCells: { x: number, y: number, size: number, res: string, stroke: string }[] = [];
    const subdivide = (x: number, y: number, size: number) => {
      // Find closest point on the cell to the center ego vehicle
      const closestX = Math.max(x, Math.min(center.x, x + size));
      const closestY = Math.max(y, Math.min(center.y, y + size));
      const dist = Math.sqrt((closestX - center.x) ** 2 + (closestY - center.y) ** 2);

      // Determine max size allowed for this radius distance
      let maxSize = 100; // default to largest cell 100px (representing 50cm)
      if (dist < 35) maxSize = 12.5;       // < 35px radius: 5cm res
      else if (dist < 70) maxSize = 25;    // < 70px radius: 10cm res
      else if (dist < 140) maxSize = 50;   // < 140px radius: 20cm res

      // Subdivide if current cell is larger than allowed for its radius
      if (size > maxSize && size > 12.5) {
        const half = size / 2;
        subdivide(x, y, half);
        subdivide(x + half, y, half);
        subdivide(x, y + half, half);
        subdivide(x + half, y + half, half);
      } else {
        let res = '50 cm';
        let stroke = 'stroke-primary/20';
        if (size <= 12.5) { res = '5 cm'; stroke = 'stroke-primary/80'; }
        else if (size <= 25) { res = '10 cm'; stroke = 'stroke-primary/60'; }
        else if (size <= 50) { res = '20 cm'; stroke = 'stroke-primary/40'; }

        aCells.push({ x, y, size, res, stroke });
      }
    };

    // Start quadtree at full 400x400 SVG size
    subdivide(0, 0, 400);

    return { uniformCells: uCells, adaptiveCells: aCells };
  }, []);

  const activeCells = mode === 'uniform' ? uniformCells : adaptiveCells;

  return (
    <div className="flex-1 md:max-h-160 rounded-4xl overflow-hidden relative flex flex-col md:flex-row gap-2 bg-background border border-border p-2">

      {/* Left panel: Info & Controls */}
      <div className="w-full md:w-1/3 md:max-w-80 bg-radial from-transparent from-10% to-primary/5 to-100% p-3 flex flex-col relative z-10 rounded-2xl">
        {/* Buttons */}
        <div className="flex flex-col gap-2 bg-radial from-transparent from-10% to-primary/10 to-100% p-1.5 rounded-3xl mb-10">
          <button
            onClick={() => setMode('uniform')}
            className={`py-3 px-4 text-sm rounded-2xl transition-all flex justify-between items-center ${mode === 'uniform' ? 'bg-radial from-primary/70 from-10% to-primary to-100% text-primary-foreground' : 'text-foreground/80'}`}
          >
            Uniform Grid (5cm)
          </button>
          <button
            onClick={() => setMode('adaptive')}
            className={`py-3 px-4 text-sm rounded-2xl transition-all flex justify-between items-center ${mode === 'adaptive' ? 'bg-radial from-primary/70 from-10% to-primary to-100% text-primary-foreground' : 'text-foreground/80'}`}
          >
            Adaptive Grid (5 - 50cm)
          </button>
        </div>

        {/* Info Text */}
        <div className="mb-8">
          <div className="text-foreground mb-3">
            {mode === 'uniform' ? 'Memory Bottleneck' : 'Foveated Efficiency'}
          </div>
          <div className="text-muted-foreground leading-relaxed">
            {mode === 'uniform'
              ? 'A uniform grid maps the distant sky and close-up roads with the exact same resolution. This creates massive, unnecessary spatial arrays in memory.'
              : 'Our adaptive approach uses "Foveated Mapping". Areas critical for safety (near the car) get high resolution (5cm), while distant or safe areas get lower resolution (up to 50cm). This cuts memory usage drastically.'}
          </div>
        </div>
      </div>

      <div className="w-full md:w-2/3 h-[450px] md:h-auto bg-card/30 rounded-2xl relative p-4 md:p-8 min-h-0 overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:24px_24px]"></div>

        <div className="relative flex items-center justify-center w-full h-full max-w-full max-h-full min-h-0">
          <div className="relative w-full h-full max-h-full max-w-full aspect-square">
            <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full z-10">
              {/* Draw the Quadtree cells */}
              {activeCells.map(c => (
                <rect key={`${mode}-${c.x}-${c.y}`} x={c.x} y={c.y} width={c.size} height={c.size}
                  className={`fill-card ${c.stroke} hover:fill-primary/20 transition-colors cursor-pointer`}
                  onMouseEnter={() => setHoveredCell({ x: c.x, y: c.y, res: c.res })}
                  onMouseLeave={() => setHoveredCell(null)}
                />
              ))}

              {/* Draw faint radius indicator circles if adaptive mode */}
              {mode === 'adaptive' && (
                <>
                  <circle cx={center.x} cy={center.y} r={35} className="fill-none stroke-primary/30 stroke-[1] border-dashed [stroke-dasharray:4_4]" />
                  <circle cx={center.x} cy={center.y} r={70} className="fill-none stroke-primary/20 stroke-[1] border-dashed [stroke-dasharray:4_4]" />
                  <circle cx={center.x} cy={center.y} r={140} className="fill-none stroke-primary/10 stroke-[1] border-dashed [stroke-dasharray:4_4]" />
                </>
              )}

              {/* Center ego vehicle marker */}
              <circle cx={center.x} cy={center.y} r={6} className="fill-primary" />
              <circle cx={center.x} cy={center.y} r={12} className="fill-none stroke-primary/50 stroke-[2] animate-ping" />
            </svg>

            {/* Tooltip on hover */}
            {hoveredCell && (
              <div
                className="absolute pointer-events-none bg-card border border-border text-foreground px-3 py-2 rounded-lg text-xs z-20 flex flex-col gap-1 transition-all"
                style={{
                  left: `calc(${(hoveredCell.x / 400) * 100}% + 20px)`,
                  top: `calc(${(hoveredCell.y / 400) * 100}% - 10px)`
                }}
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MousePointer2 className="w-3 h-3" /> Cell Inspector
                </div>
                <div>Res: <span className="font-mono text-primary">{hoveredCell.res}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
