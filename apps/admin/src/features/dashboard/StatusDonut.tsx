import { useEffect, useState } from 'react';
import { Skeleton } from '@cullinos/ui';

export interface StatusCounts {
  completed: number;
  open: number;
  preparing: number;
  cancelled: number;
}

const SEGMENTS: Array<{ key: keyof StatusCounts; label: string; color: string; dot: string }> = [
  { key: 'completed', label: 'Completed', color: 'var(--color-status-success)', dot: 'bg-status-success' },
  { key: 'open', label: 'Open', color: 'var(--color-status-info)', dot: 'bg-status-info' },
  { key: 'preparing', label: 'Preparing', color: 'var(--color-status-warning)', dot: 'bg-status-warning' },
  { key: 'cancelled', label: 'Cancelled', color: 'var(--color-status-error)', dot: 'bg-status-error' },
];

const SIZE = 168;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function StatusDonut({ counts, loading }: { counts: StatusCounts | null; loading: boolean }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (loading || !counts) {
    return (
      <div className="flex flex-col items-center gap-6 sm:flex-row xl:flex-col">
        <Skeleton className="h-[168px] w-[168px] rounded-full" />
        <div className="w-full space-y-3">
          {SEGMENTS.map((s) => (
            <Skeleton key={s.key} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const total = SEGMENTS.reduce((sum, s) => sum + counts[s.key], 0);
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row xl:flex-col">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            style={{ stroke: 'var(--color-bg-elevated)' }}
          />
          {total > 0
            ? SEGMENTS.map((s) => {
                const length = (counts[s.key] / total) * CIRCUMFERENCE;
                const dash = drawn ? Math.max(length - (length > 4 ? 3 : 0), 0) : 0;
                const circle = (
                  <circle
                    key={s.key}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    strokeWidth={STROKE}
                    strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-offset}
                    style={{
                      stroke: s.color,
                      transition: 'stroke-dasharray 900ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                );
                offset += length;
                return circle;
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold tabular-nums text-text-primary">{total}</span>
          <span className="text-xs text-text-muted">Total</span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-3">
        {SEGMENTS.map((s) => {
          const count = counts[s.key];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-text-secondary">{s.label}</span>
              <span className="w-8 text-right font-semibold tabular-nums text-text-primary">{count}</span>
              <span className="w-10 text-right tabular-nums text-text-muted">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
