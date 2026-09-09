import type { FoveatedGridResult } from '../lib/foveatedGrid';
import type { FrameData } from '../lib/binaryProtocol';

interface Props {
  gridResult: FoveatedGridResult | null;
  mode: 'simulated' | 'live';
  liveFrame: FrameData | null;
}

export default function MemorySavingsHUD({ gridResult, mode, liveFrame }: Props) {
  let memorySavingsPct = 0;
  let nearCount = 0;
  let midCount = 0;
  let farCount = 0;
  let totalCount = 0;
  let rawCount = 124668;

  if (mode === 'simulated' && gridResult) {
    memorySavingsPct = gridResult.memorySavingsPct;
    nearCount = gridResult.nearCount;
    midCount = gridResult.midCount;
    farCount = gridResult.farCount;
    totalCount = nearCount + midCount + farCount;
  } else if (mode === 'live' && liveFrame && liveFrame.cell_x) {
    totalCount = liveFrame.cell_x.length;

    // Use real point count from backend (before any subsampling)
    rawCount = liveFrame.num_points > 0 ? liveFrame.num_points : (liveFrame.raw_x ? liveFrame.raw_x.length : 124668);
    memorySavingsPct = Math.max(0, (1 - totalCount / rawCount) * 100);

    // Count cells per band matching backend config bands
    for (let i = 0; i < totalCount; i++) {
      const x = liveFrame.cell_x[i];
      const y = liveFrame.cell_y[i];
      const dist = Math.sqrt(x * x + y * y);
      if (dist < 10.0) nearCount++;
      else if (dist < 60.0) midCount++;
      else farCount++;
    }
  }

  return (
    <div className="h-fit w-full text-sm p-4 justify-center text-foreground font-bold">
      <div className="text-emerald-500 mb-1.5 text-base">
        {memorySavingsPct.toFixed(2)}% memory savings vs raw point cloud
      </div>
      <div className="text-emerald-500/80 mb-2 text-xs font-mono font-normal">
        Math: 100 - ({totalCount} cells / {rawCount} raw pts) * 100
      </div>
      <div className="text-muted-foreground mb-6 text-xs font-normal">
        3D → adaptive 2.5D foveated grid (majority-vote semantic)
      </div>
      <div className="space-y-3 text-muted-foreground">
        <div className="flex justify-between items-center text-foreground">
          <span>Total cells projected</span>
          <span>{totalCount} cells</span>
        </div>
        <div className="flex justify-between items-center text-cyan-400">
          <span>Near 5cm (0-10m)</span>
          <span>{nearCount} cells</span>
        </div>
        <div className="flex justify-between items-center text-amber-500">
          <span>Mid 10-25cm (10-60m)</span>
          <span>{midCount} cells</span>
        </div>
        <div className="flex justify-between items-center text-red-400">
          <span>Far 50cm (60-100m)</span>
          <span>{farCount} cells</span>
        </div>
      </div>
    </div>
  );
}
