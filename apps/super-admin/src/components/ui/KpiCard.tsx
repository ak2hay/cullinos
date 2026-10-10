import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@cullinos/ui';
import { Card } from './Card';

export type KpiTone = 'indigo' | 'green' | 'orange' | 'blue' | 'violet' | 'rose' | 'slate';

const TONES: Record<KpiTone, string> = {
  indigo: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-300',
  green: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300',
  orange: 'bg-orange-500/12 text-orange-600 dark:text-orange-300',
  blue: 'bg-sky-500/12 text-sky-600 dark:text-sky-300',
  violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-300',
  rose: 'bg-rose-500/12 text-rose-600 dark:text-rose-300',
  slate: 'bg-slate-500/12 text-slate-600 dark:text-slate-300',
};

export type KpiTrend = { value: string; direction?: 'up' | 'down' | 'flat' };

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'indigo',
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: KpiTone;
  trend?: KpiTrend | null;
  className?: string;
}) {
  const direction = trend?.direction ?? 'flat';
  return (
    <Card className={cn('flex items-start gap-4 p-5', className)}>
      {Icon ? (
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', TONES[tone])}>
          <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-secondary">{label}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate font-display text-2xl font-semibold tracking-tight">{value}</p>
          {trend ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold',
                direction === 'up' && 'bg-status-success/12 text-status-success',
                direction === 'down' && 'bg-status-error/12 text-status-error',
                direction === 'flat' && 'text-status-success',
              )}
            >
              {direction === 'up' ? <ArrowUpRight size={12} aria-hidden="true" /> : null}
              {direction === 'down' ? <ArrowDownRight size={12} aria-hidden="true" /> : null}
              {trend.value}
            </span>
          ) : null}
        </div>
        {hint ? <p className="mt-1 truncate text-xs text-text-muted">{hint}</p> : null}
      </div>
    </Card>
  );
}

export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}
