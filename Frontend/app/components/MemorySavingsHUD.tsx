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
    // True memory savings vs full 0.05m uniform 3D grid (assuming e.g. 100m radius, 10m height)
    // A full uniform grid has ~ millions of cells. We approximate savings as usually >99%.
    // To match actual memory footprint vs 3D grid, calculate total uniform cells:
    const gridVolume = (200 / 0.05) * (200 / 0.05) * (10 / 0.05); // ~ 3.2 Billion
    memorySavingsPct = Math.max(0, 100 - (totalCount / gridVolume) * 100);
    if (memorySavingsPct > 99.9) memorySavingsPct = 99.9; // Cap for realism display

    // Count cells per band matching backend config (0-10m, 10-30m, 30-100m)
    for (let i = 0; i < totalCount; i++) {
      const x = liveFrame.cell_x[i];
      const y = liveFrame.cell_y[i];
      const dist = Math.sqrt(x * x + y * y);
      if (dist < 10.0) nearCount++;
      else if (dist < 30.0) midCount++;
      else farCount++;
    }
  }

  return (
    <div className="h-fit w-full text-sm p-4 justify-center text-foreground font-bold">
      <div className="text-emerald-500 mb-1.5 text-base">
        {memorySavingsPct.toFixed(2)}% memory vs uniform 3D grid (0.05m)
      </div>
      <div className="text-muted-foreground mb-8 text-xs font-normal">
        3D to adaptive 2.5D grid (majority-vote semantic)
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
