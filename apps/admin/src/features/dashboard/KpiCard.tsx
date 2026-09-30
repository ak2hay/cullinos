import type { CSSProperties, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Skeleton } from '@cullinos/ui';
import { Sparkline } from './Sparkline';
import { useCountUp } from './chart-utils';

export type KpiTone = 'success' | 'info' | 'warning' | 'violet';

const TONES: Record<KpiTone, { tile: string; color: string }> = {
  success: { tile: 'bg-status-success/12 text-status-success', color: 'var(--color-status-success)' },
  info: { tile: 'bg-status-info/12 text-status-info', color: 'var(--color-status-info)' },
  warning: { tile: 'bg-status-warning/12 text-status-warning', color: 'var(--color-status-warning)' },
  violet: { tile: 'bg-status-new/12 text-status-new', color: 'var(--color-status-new)' },
};

function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-status-success/12 px-2 py-0.5 text-xs font-semibold text-status-success">
        New
      </span>
    );
  }
  const rounded = Math.round(delta);
  const tone =
    rounded > 0
      ? 'bg-status-success/12 text-status-success'
      : rounded < 0
        ? 'bg-status-error/12 text-status-error'
        : 'bg-hover-strong text-text-muted';
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      {Math.abs(rounded)}%
    </span>
  );
}

export function KpiCard({
  label,
  value,
  format,
  icon,
  tone,
  delta,
  hint,
  spark,
  live,
  loading,
  style,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  icon: ReactNode;
  tone: KpiTone;
  delta?: number | null;
  hint: string;
  spark?: number[];
  live?: boolean;
  loading?: boolean;
  style?: CSSProperties;
}) {
  const animated = useCountUp(loading ? 0 : value);
  const palette = TONES[tone];

  return (
    <div
      style={style}
      className="group animate-slide-up rounded-2xl border border-line-subtle bg-bg-card p-5 shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${palette.tile}`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-secondary">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="font-display text-2xl font-bold tracking-tight text-text-primary tabular-nums sm:text-[1.75rem]">
                {format(animated)}
              </p>
              {live ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-warning/12 px-2 py-0.5 text-xs font-semibold text-status-warning">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-warning opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-warning" />
                  </span>
                  Live
                </span>
              ) : delta !== undefined ? (
                <DeltaChip delta={delta} />
              ) : null}
            </div>
          )}
          <p className="mt-1 truncate text-xs text-text-muted">{hint}</p>
        </div>
        {spark && spark.length > 1 && !loading ? (
          <div className="hidden self-end pb-1 opacity-90 transition-opacity group-hover:opacity-100 min-[420px]:block">
            <Sparkline values={spark} color={palette.color} width={76} height={34} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
