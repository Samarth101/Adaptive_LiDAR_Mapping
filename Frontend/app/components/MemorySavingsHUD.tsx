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

  if (mode === 'simulated' && gridResult) {
    memorySavingsPct = gridResult.memorySavingsPct;
    nearCount = gridResult.nearCount;
    midCount = gridResult.midCount;
    farCount = gridResult.farCount;
    totalCount = nearCount + midCount + farCount;
  } else if (mode === 'live' && liveFrame && liveFrame.cell_x) {
    totalCount = liveFrame.cell_x.length;
    const rawCount = liveFrame.raw_x ? liveFrame.raw_x.length : 120000;
    memorySavingsPct = Math.max(0, 100 - (totalCount / rawCount) * 100);

    // Count cells per band
    for (let i = 0; i < totalCount; i++) {
      const x = liveFrame.cell_x[i];
      const y = liveFrame.cell_y[i];
      const dist = Math.sqrt(x * x + y * y);
      if (dist < 5.0) nearCount++;
      else if (dist < 20.0) midCount++;
      else farCount++;
    }
  }

  return (
    <div className="h-fit w-full text-sm p-4 justify-center text-foreground">
      <div className="text-emerald-500 mb-1.5">
        {memorySavingsPct.toFixed(1)}% memory vs uniform 5cm (0.05m)
      </div>
      <div className="text-muted-foreground mb-8">
        3D to 2.5D grid (majority-vote semantic)
      </div>
      <div className="space-y-3 text-muted-foreground">
        <div className="flex justify-between items-center text-foreground">
          <span>Total cells projected</span>
          <span>{totalCount} cells</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Near 5cm (0-5m)</span>
          <span>{nearCount} cells</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Mid 50cm (5-20m)</span>
          <span>{midCount} cells</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Far 50cm (20-100m)</span>
          <span>{farCount} cells</span>
        </div>
      </div>
    </div>
  );
}
