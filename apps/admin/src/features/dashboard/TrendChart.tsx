import { useId, useMemo, useState } from 'react';
import { Skeleton } from '@cullinos/ui';
import { niceScale, smoothPath, useElementWidth } from './chart-utils';

export interface TrendDay {
  date: string;
  revenue: number;
  orders: number;
}

const HEIGHT = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 52 };

function shortDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function compactRupees(paise: number) {
  const rupees = paise / 100;
  if (rupees >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(1)}Cr`;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(1)}L`;
  if (rupees >= 1_000) return `₹${(rupees / 1_000).toFixed(rupees >= 10_000 ? 0 : 1)}k`;
  return `₹${Math.round(rupees)}`;
}

export function TrendChart({
  days,
  mode,
  loading,
  formatMoney,
}: {
  days: TrendDay[];
  mode: 'revenue' | 'orders';
  loading: boolean;
  formatMoney: (paise: number) => string;
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = `trend-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const geometry = useMemo(() => {
    const values = days.map((d) => (mode === 'revenue' ? d.revenue : d.orders));
    const scale = niceScale(Math.max(...values, 0));
    const innerW = Math.max(width - PAD.left - PAD.right, 1);
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const points = values.map((v, i) => ({
      x: PAD.left + (days.length > 1 ? (i / (days.length - 1)) * innerW : innerW / 2),
      y: PAD.top + (1 - v / scale.max) * innerH,
    }));
    const line = smoothPath(points);
    const baseline = PAD.top + innerH;
    const area = points.length > 1 ? `${line} L${points[points.length - 1].x},${baseline} L${points[0].x},${baseline} Z` : '';
    const ticks = Array.from({ length: 5 }, (_, i) => scale.step * i);
    const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(Math.floor(innerW / 64), 1)));
    return { values, scale, innerW, innerH, points, line, area, ticks, baseline, labelEvery };
  }, [days, mode, width]);

  if (loading) {
    return <Skeleton className="h-[240px] w-full rounded-xl" />;
  }

  const { points, line, area, ticks, scale, innerH, baseline, labelEvery, values } = geometry;
  const active = hover !== null ? points[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let nearest = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].x - x) < Math.abs(points[nearest].x - x)) nearest = i;
    }
    setHover(nearest);
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height: HEIGHT }}>
      {width > 0 ? (
        <svg
          width={width}
          height={HEIGHT}
          className="block touch-none select-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={mode === 'revenue' ? 'Revenue trend' : 'Orders trend'}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--color-brand-primary)', stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: 'var(--color-brand-primary)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {ticks.map((tick) => {
            const y = PAD.top + (1 - tick / scale.max) * innerH;
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y}
                  y2={y}
                  style={{ stroke: 'var(--color-line-subtle)' }}
                  strokeDasharray={tick === 0 ? undefined : '4 4'}
                />
                <text x={PAD.left - 10} y={y + 4} textAnchor="end" fontSize={11} style={{ fill: 'var(--color-text-muted)' }}>
                  {mode === 'revenue' ? compactRupees(tick) : tick}
                </text>
              </g>
            );
          })}

          {days.map((d, i) =>
            i % labelEvery === 0 || i === days.length - 1 ? (
              <text
                key={d.date}
                x={points[i]?.x}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize={11}
                style={{ fill: 'var(--color-text-muted)' }}
              >
                {shortDate(d.date)}
              </text>
            ) : null,
          )}

          <g key={`${mode}-${days.length}`}>
            {area ? <path d={area} fill={`url(#${gradientId})`} className="animate-fade-in" /> : null}
            <path
              d={line}
              fill="none"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              style={{
                stroke: 'var(--color-brand-primary)',
                ['--ui-draw-length' as string]: 1,
                animation: 'ui-draw 1s var(--ease-out) both',
              }}
            />
            {points.map((p, i) => (
              <circle
                key={days[i].date}
                cx={p.x}
                cy={p.y}
                r={hover === i ? 5.5 : 3.5}
                strokeWidth={2}
                className="transition-[r] duration-150"
                style={{ fill: 'var(--color-bg-card)', stroke: 'var(--color-brand-primary)' }}
              />
            ))}
          </g>

          {active ? (
            <line
              x1={active.x}
              x2={active.x}
              y1={PAD.top}
              y2={baseline}
              style={{ stroke: 'var(--color-line-strong)' }}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          ) : null}
        </svg>
      ) : null}

      {active && hover !== null ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-bg-secondary px-3 py-2 text-center shadow-md transition-[left,top] duration-100"
          style={{ left: Math.min(Math.max(active.x, 64), width - 64), top: active.y - 12 }}
        >
          <p className="font-mono text-sm font-semibold text-text-primary">
            {mode === 'revenue' ? formatMoney(values[hover]) : `${values[hover]} orders`}
          </p>
          <p className="text-[11px] text-text-muted">{shortDate(days[hover].date)}</p>
        </div>
      ) : null}
    </div>
  );
}
