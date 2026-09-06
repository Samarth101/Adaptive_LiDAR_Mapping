import type { FoveatedGridResult } from '../lib/foveatedGrid';

interface Props {
  gridResult: FoveatedGridResult;
}

export default function MemorySavingsHUD({ gridResult }: Props) {
  const { memorySavingsPct, nearCount, midCount, farCount, totalCount } = gridResult;

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
