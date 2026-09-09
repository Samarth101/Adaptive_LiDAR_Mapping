'use client';

import { Separator } from '@/components/ui/separator';
import type { FrameMetrics } from '../types/dataset';

interface Props {
  metrics: { objects_detected: number };
  fps: number;
  memorySavingsPct: number;
  frameId: number;
  mode: 'simulated' | 'live';
}

function Bar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-[4px] bg-muted rounded overflow-hidden flex-1 mt-1.5">
      <div className={`h-full transition-[width] duration-300 ease-in-out ${colorClass}`} style={{ width: pct + '%' }} />
    </div>
  );
}

export default function MetricsHUD({ metrics, fps, memorySavingsPct, frameId, mode }: Props) {
  const fpsLabel = mode === 'live' ? 'Processing FPS' : 'Render FPS';
  const fpsDisplay = mode === 'live' ? fps.toFixed(2) : fps.toFixed(0);
  return (
    <div className="p-4 h-fit space-y-3">
      <div className="text-sm">
        <span className='text-muted-foreground'>Frame</span> - {frameId}
      </div>
      <Separator />
      <div className="flex flex-col gap-5">
        <Row label={fpsLabel} value={fpsDisplay} valueClass="text-foreground" />

        <BarRow label="Objects Detected" value={String(metrics.objects_detected)} barValue={metrics.objects_detected} barMax={20} barClass="bg-primary" valueClass="text-foreground" />
      </div>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="flex justify-between items-center gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function BarRow({ label, value, barValue, barMax, barClass, valueClass }: {
  label: string; value: string; barValue: number; barMax: number; barClass: string; valueClass: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-center gap-4 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={valueClass}>{value}</span>
      </div>
      <Bar value={barValue} max={barMax} colorClass={barClass} />
    </div>
  );
}
