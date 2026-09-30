import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { Skeleton } from '@cullinos/ui';

export interface TopItem {
  name: string;
  quantity: number;
  imageUrl?: string | null;
}

const RANK_STYLES = [
  'bg-brand-primary text-on-brand',
  'bg-brand-primary/25 text-brand-primary',
  'bg-brand-primary/15 text-brand-primary',
];

export function TopItems({ items, loading }: { items: TopItem[]; loading: boolean }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, [items]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line py-10 text-center">
        <Trophy size={24} className="text-text-muted" aria-hidden="true" />
        <p className="text-sm font-medium text-text-secondary">No sales yet for this day</p>
        <p className="text-xs text-text-muted">Best sellers show up once orders are completed.</p>
      </div>
    );
  }

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0) || 1;
  const maxQty = Math.max(...items.map((i) => i.quantity), 1);

  return (
    <ol className="space-y-3">
      {items.map((item, i) => {
        const share = Math.round((item.quantity / totalQty) * 100);
        return (
          <li key={item.name} className="flex items-center gap-3">
            <span
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                RANK_STYLES[i] ?? 'bg-bg-elevated text-text-muted'
              }`}
            >
              {i + 1}
            </span>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-text-primary">{item.quantity}</p>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent transition-[width] duration-700 ease-[var(--ease-out)]"
                    style={{ width: grown ? `${(item.quantity / maxQty) * 100}%` : '0%', transitionDelay: `${i * 60}ms` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-xs tabular-nums text-text-muted">{share}%</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
