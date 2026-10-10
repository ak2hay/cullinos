import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@cullinos/ui';
import { errorMessage } from '@/lib/errors';

export { errorMessage };

export const inputClass =
  'w-full rounded-lg border border-line bg-bg-card px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60';

const NOTICE_TONES = {
  info: { cls: 'border-status-info/25 bg-status-info/8 text-status-info', icon: Info },
  error: { cls: 'border-status-error/25 bg-status-error/8 text-status-error', icon: AlertCircle },
  success: { cls: 'border-status-success/25 bg-status-success/8 text-status-success', icon: CheckCircle2 },
  warning: { cls: 'border-status-warning/25 bg-status-warning/8 text-status-warning', icon: AlertTriangle },
} as const;

export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: keyof typeof NOTICE_TONES;
  children: ReactNode;
  className?: string;
}) {
  const t = NOTICE_TONES[tone];
  const Icon = t.icon;
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={cn('flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm', t.cls, className)}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function MutationError({ error }: { error: unknown }) {
  const msg = errorMessage(error);
  return msg ? <p className="text-sm text-status-error">{msg}</p> : null;
}

export function LabeledInput({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-text-secondary">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}

export function splitList(v: string): string[] {
  return v
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
