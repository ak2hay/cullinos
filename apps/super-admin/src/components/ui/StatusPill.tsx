import { cn } from '@cullinos/ui';

export type PillTone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'brand';

const STATUS_TONES: Record<string, PillTone> = {
  pending: 'warning',
  pending_approval: 'warning',
  approved: 'info',
  executing: 'info',
  executed: 'success',
  rejected: 'error',
  expired: 'neutral',
  cancelled: 'neutral',
  canceled: 'neutral',
  active: 'success',
  enabled: 'success',
  healthy: 'success',
  ok: 'success',
  up: 'success',
  paid: 'success',
  revoked: 'error',
  open: 'warning',
  in_progress: 'info',
  waiting_customer: 'neutral',
  resolved: 'success',
  closed: 'neutral',
  queued: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'error',
  error: 'error',
  down: 'error',
  degraded: 'warning',
  certified: 'success',
  on_leave: 'warning',
  notice: 'warning',
  exited: 'neutral',
  suspended: 'error',
  deleted: 'neutral',
  disabled: 'neutral',
  inactive: 'neutral',
  draft: 'neutral',
  published: 'success',
  scheduled: 'info',
  sent: 'success',
  trial: 'info',
  trialing: 'info',
  past_due: 'warning',
  grace: 'warning',
  halted: 'error',
  low: 'neutral',
  normal: 'info',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
  critical: 'error',
};

const TONE_CLASSES: Record<PillTone, { pill: string; dot: string }> = {
  success: {
    pill: 'bg-emerald-50 text-emerald-700 dark:bg-status-success/12 dark:text-status-success',
    dot: 'bg-emerald-500 dark:bg-status-success',
  },
  warning: {
    pill: 'bg-amber-50 text-amber-700 dark:bg-status-warning/12 dark:text-status-warning',
    dot: 'bg-amber-500 dark:bg-status-warning',
  },
  error: {
    pill: 'bg-red-50 text-red-700 dark:bg-status-error/12 dark:text-status-error',
    dot: 'bg-red-500 dark:bg-status-error',
  },
  info: {
    pill: 'bg-blue-50 text-blue-700 dark:bg-status-info/12 dark:text-status-info',
    dot: 'bg-blue-500 dark:bg-status-info',
  },
  brand: { pill: 'bg-indigo-50 text-indigo-700 dark:bg-accent/12 dark:text-accent', dot: 'bg-accent' },
  neutral: { pill: 'bg-slate-100 text-slate-600 dark:bg-bg-elevated dark:text-text-secondary', dot: 'bg-slate-400 dark:bg-text-muted' },
};

export function statusTone(status: string | null | undefined): PillTone {
  return (status && STATUS_TONES[status.toLowerCase()]) || 'neutral';
}

function humanize(value: string) {
  const s = value.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusPill({
  status,
  label,
  tone,
  dot = true,
  className,
}: {
  status: string;
  label?: string;
  tone?: PillTone;
  dot?: boolean;
  className?: string;
}) {
  const t = TONE_CLASSES[tone ?? statusTone(status)];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        t.pill,
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', t.dot)} /> : null}
      {label ?? humanize(status)}
    </span>
  );
}

export function RiskPill({ risk }: { risk: string | null | undefined }) {
  return risk ? <StatusPill status={risk} dot={false} /> : null;
}

export function StatusDot({ tone = 'neutral', className }: { tone?: PillTone; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block h-2 w-2 rounded-full', TONE_CLASSES[tone].dot, className)} />;
}
