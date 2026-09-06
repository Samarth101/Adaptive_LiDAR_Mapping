export default function SemanticLegend() {
  const legendItems = [
    { label: 'road (drivable)', color: '#4a90d9' },
    { label: 'curb (non-drivable)', color: '#d4870a' },
    { label: 'vegetation', color: '#3aaa5c' },
    { label: 'building', color: '#607b96' },
    { label: 'pothole', color: '#e03018' },
  ];
  const staticObjs = [
    { label: '[S] road barrier', color: '#e5e5e5' },
    { label: '[S] pothole', color: '#ef4444' },
  ];
  const dynamicObjs = [
    { label: '[D] pedestrian', color: '#00e5ff' },
    { label: '[D] bus/truck', color: '#ff6a00' },
    { label: '[D] auto-rickshaw', color: '#a855f7' },
    { label: '[D] bicycle', color: '#84cc16' },
    { label: '[D] cattle', color: '#f59e0b' },
  ];

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
