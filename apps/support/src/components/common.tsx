import type { ReactNode } from 'react';
import { cn } from '@cullinos/ui';
import { slaLabel } from '@/lib/format';
import { PRIORITY_LABELS, STATUS_LABELS, type TicketPriority, type TicketStatus } from '@/lib/support-api';

export const inputClass =
  'h-9 w-full rounded-lg border border-line bg-bg-card px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20';

export const textareaClass =
  'w-full rounded-lg border border-line bg-bg-card px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20';

export function Label({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-text-secondary">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        tone === 'error' && 'border-status-error/30 bg-status-error/10 text-status-error',
        tone === 'success' && 'border-status-success/30 bg-status-success/10 text-status-success',
        tone === 'info' && 'border-line bg-bg-elevated text-text-secondary',
      )}
    >
      {children}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  flush,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={cn('rounded-xl border border-line-subtle bg-bg-card', className)}>
      {title || actions ? (
        <header className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

const STATUS_TONE: Record<TicketStatus, string> = {
  open: 'bg-sky-500/12 text-sky-600 dark:text-sky-300',
  in_progress: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-300',
  waiting_customer: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  resolved: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  closed: 'bg-slate-500/12 text-slate-600 dark:text-slate-300',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', STATUS_TONE[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_TONE: Record<TicketPriority, string> = {
  urgent: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
  normal: 'bg-slate-500/12 text-slate-600 dark:text-slate-300',
  low: 'bg-slate-500/8 text-text-muted',
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', PRIORITY_TONE[priority])}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function SlaBadge({ due, done }: { due: string | null; done?: boolean }) {
  const s = slaLabel(due);
  if (!s || done) return <span className="text-xs text-text-muted">—</span>;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums',
        s.tone === 'breach' && 'bg-status-error/12 text-status-error',
        s.tone === 'warn' && 'bg-status-warning/15 text-status-warning',
        s.tone === 'ok' && 'bg-status-success/10 text-status-success',
      )}
    >
      {s.text}
    </span>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="px-4 py-12 text-center text-sm text-text-muted">{children}</p>;
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent/15 font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}

/** Splits "name | https://url" lines into attachment objects. */
export function parseAttachmentLines(text: string): { name: string; url: string }[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [a, b] = line.split('|').map((s) => s.trim());
      const url = b ?? a;
      const name = b ? a : url.replace(/^https?:\/\//, '').slice(0, 80);
      return { name, url };
    })
    .filter((x) => /^https?:\/\//i.test(x.url));
}

export function AttachmentList({ items }: { items: { name: string; url: string }[] | null | undefined }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((a) => (
        <li key={a.url}>
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-[16rem] items-center gap-1 truncate rounded-md border border-line px-2 py-1 text-xs text-accent hover:bg-hover"
          >
            {a.name}
          </a>
        </li>
      ))}
    </ul>
  );
}
