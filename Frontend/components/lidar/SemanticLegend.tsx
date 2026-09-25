import { CLASSIFICATION_CONFIG } from '@/lib/classificationData';
import { memo } from 'react';

export default memo(function SemanticLegend() {
  const legendItems: { label: string; color: string }[] = [];
  const staticObjs: { label: string; color: string }[] = [];
  const dynamicObjs: { label: string; color: string }[] = [];

  Object.values(CLASSIFICATION_CONFIG).forEach(group => {
    Object.values(group).forEach(entry => {
      if (entry.category === 'terrain') {
        legendItems.push({ label: entry.label, color: entry.color });
      } else if (entry.category === 'static') {
        staticObjs.push({ label: `[S] ${entry.label}`, color: entry.color });
      } else if (entry.category === 'dynamic') {
        dynamicObjs.push({ label: `[D] ${entry.label}`, color: entry.color });
      }
    });
  });

  const Item = ({ color, label }: { color: string, label: string }) => (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}80` }} />
      <div className="text-foreground/90">{label}</div>
    </div>
  );

  return (
    <div className="w-full h-fit bg-card rounded-2xl p-4 text-sm flex flex-col gap-3 font-normal">
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
        <div className="text-muted-foreground text-sm shrink-0">Terrain:</div>
        <div className="flex flex-wrap gap-2 md:gap-3">
          {legendItems.map((item, i) => <Item key={i} {...item} />)}
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
        <div className="text-muted-foreground text-sm shrink-0">Static Obstacles:</div>
        <div className="flex flex-wrap gap-2 md:gap-3">
          {staticObjs.map((item, i) => <Item key={i} {...item} />)}
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
        <div className="text-muted-foreground text-sm shrink-0">Dynamic Objects:</div>
        <div className="flex flex-wrap gap-2 md:gap-3">
          {dynamicObjs.map((item, i) => <Item key={i} {...item} />)}
        </div>
      </div>
    </div>
  );
});
