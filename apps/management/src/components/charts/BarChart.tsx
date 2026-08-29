export interface BarChartItem {
  label: string;
  value: number;
  displayValue?: string;
}

interface BarChartProps {
  items: BarChartItem[];
  valueLabel?: string;
  colorClass?: string;
}

export function BarChart({
  items,
  valueLabel = 'Value',
  colorClass = 'bg-brand-primary',
}: BarChartProps) {
  const max = Math.max(...items.map((i) => i.value), 1);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-bg-card p-8 text-center text-sm text-text-muted">
        No data to display
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const width = `${Math.round((item.value / max) * 100)}%`;
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">{item.label}</span>
              <span className="text-text-secondary">
                {item.displayValue ?? item.value.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className={`h-full rounded-full transition-all ${colorClass}`}
                style={{ width }}
                title={`${item.label}: ${item.displayValue ?? item.value}`}
              />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-text-muted">{valueLabel}</p>
    </div>
  );
}
