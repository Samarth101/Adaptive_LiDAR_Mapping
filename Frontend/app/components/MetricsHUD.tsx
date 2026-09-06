'use client';

import { Separator } from '@/components/ui/separator';
import type { FrameMetrics } from '../types/dataset';

interface Props {
  metrics: FrameMetrics;
  fps: number;
  memorySavingsPct: number;
  frameId: number;
}

function Bar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-[4px] bg-muted rounded overflow-hidden flex-1 mt-1.5">
      <div className={`h-full transition-[width] duration-300 ease-in-out ${colorClass}`} style={{ width: pct + '%' }} />
    </div>
  );
}

export default function MetricsHUD({ metrics, fps, memorySavingsPct, frameId }: Props) {
  const risk = metrics.collision_risk;
  const riskColorClass = risk > 0.6 ? 'bg-destructive' : risk > 0.3 ? 'bg-primary' : 'bg-primary/60';
  const riskTextClass = risk > 0.6 ? 'text-destructive' : 'text-foreground';

  return (
    <div className="p-4 h-fit space-y-3">
      <div className="text-sm">
        <span className='text-muted-foreground'>Frame</span> - {frameId}
      </div>
      <Separator />
      <div className="flex flex-col gap-5">
        <Row label="FPS" value={fps.toFixed(0)} valueClass="text-foreground" />

        <BarRow label="Latency" value={metrics.latency_ms.toFixed(1) + 'ms'} barValue={metrics.latency_ms} barMax={200} barClass="bg-primary" valueClass="text-foreground" />

        <BarRow label="Objects" value={String(metrics.objects_detected)} barValue={metrics.objects_detected} barMax={20} barClass="bg-primary" valueClass="text-foreground" />

        <BarRow label="Risk" value={(risk * 100).toFixed(0) + '%'} barValue={risk} barMax={1} barClass={riskColorClass} valueClass={riskTextClass} />

        <BarRow label="Perception" value={metrics.perception_latency_ms.toFixed(1) + 'ms'} barValue={metrics.perception_latency_ms} barMax={100} barClass="bg-primary" valueClass="text-foreground" />
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
