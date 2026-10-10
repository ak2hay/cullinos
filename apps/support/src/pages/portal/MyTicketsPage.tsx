import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { cn } from '@cullinos/ui';
import { EmptyRow, Notice, StatusBadge, inputClass } from '@/components/common';
import { errorMessage } from '@/lib/api';
import { formatDate, relativeTime } from '@/lib/format';
import { CATEGORY_LABELS, customerApi } from '@/lib/support-api';

const TABS = [
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Resolved & closed' },
  { id: 'all', label: 'All' },
] as const;

export function MyTicketsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('open');
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState('');
  const list = useQuery({
    queryKey: ['portal', 'tickets', tab, mine, q],
    queryFn: () => customerApi.tickets({ status: tab === 'all' ? undefined : tab, mine, q: q.trim() || undefined }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Tickets</h1>
          <p className="text-sm text-text-secondary">Every ticket raised by your restaurant.</p>
        </div>
        <Link
          to="/tickets/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-primary px-3 text-sm font-medium text-on-brand hover:bg-brand-primary-dark"
        >
          <Plus size={16} aria-hidden="true" />
          Raise a ticket
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-line p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn('rounded-md px-3 py-1.5 text-sm', tab === t.id ? 'bg-accent/15 font-medium text-accent' : 'text-text-secondary hover:text-text-primary')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          Only mine
        </label>
        <input className={`${inputClass} ml-auto w-64`} placeholder="Search subject or TKT number" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.error ? <Notice tone="error">{errorMessage(list.error)}</Notice> : null}
      <div className="overflow-hidden rounded-xl border border-line-subtle bg-bg-card">
        <ul className="divide-y divide-line-subtle">
          {(list.data ?? []).map((t) => (
            <li key={t.id}>
              <Link to={`/tickets/${t.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-hover">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.subject}</p>
                  <p className="truncate text-xs text-text-muted">
                    {t.ref} · {CATEGORY_LABELS[t.category] ?? t.category} · opened {formatDate(t.createdAt)} · {t.replyCount} replies
                  </p>
                </div>
                <StatusBadge status={t.status} />
                <span className="w-24 text-right text-xs text-text-muted">{relativeTime(t.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {!list.isLoading && (list.data ?? []).length === 0 ? <EmptyRow>No tickets here.</EmptyRow> : null}
      </div>
    </div>
  );
}
