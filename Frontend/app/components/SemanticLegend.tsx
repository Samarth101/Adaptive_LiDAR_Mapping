import { CLASSIFICATION_CONFIG } from '../lib/classificationData';

export default function SemanticLegend() {
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
    <div className="w-full h-fit bg-card rounded-md p-4 text-sm flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="text-muted-foreground text-sm">Terrain:</div>
        <div className="flex gap-3">
          {legendItems.map((item, i) => <Item key={i} {...item} />)}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-muted-foreground text-sm">Static Obstacles:</div>
        <div className="flex gap-3">
          {staticObjs.map((item, i) => <Item key={i} {...item} />)}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-muted-foreground text-sm">Dynamic Objects:</div>
        <div className="flex gap-3">
          {dynamicObjs.map((item, i) => <Item key={i} {...item} />)}
        </div>
      </div>
    </div>
  );
}
