import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';
import { Button } from '@cullinos/ui';
import { QUEUES, type QueueId } from '@/components/AgentShell';
import { EmptyRow, Notice, PriorityBadge, SlaBadge, StatusBadge, inputClass } from '@/components/common';
import { errorMessage } from '@/lib/api';
import { personName, relativeTime } from '@/lib/format';
import { CATEGORY_LABELS, PRIORITY_LABELS, agentApi, type TicketPriority } from '@/lib/support-api';

const CLOSED = ['resolved', 'closed'];

export function AgentQueuePage() {
  const { queue = 'mine' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const def = QUEUES.find((q) => q.id === (queue as QueueId)) ?? QUEUES[0];
  const q = params.get('q') ?? '';
  const [priority, setPriority] = useState<string>('');

  const filter = useMemo(() => ({ ...def.filter, q: q || undefined, priority: priority || undefined }), [def, q, priority]);
  const list = useInfiniteQuery({
    queryKey: ['agent', 'tickets', filter],
    queryFn: ({ pageParam }) => agentApi.tickets({ ...filter, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">{def.label}</h1>
          <p className="text-sm text-text-secondary">
            {q ? `Search: "${q}" · ` : ''}
            {list.isLoading ? 'Loading…' : `${rows.length}${list.hasNextPage ? '+' : ''} tickets`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {q ? (
            <Button size="sm" variant="ghost" onClick={() => setParams({})}>
              Clear search
            </Button>
          ) : null}
          <select className={`${inputClass} w-44`} value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
            <option value="">All priorities</option>
            {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <Button size="sm" variant="secondary" className="gap-2" onClick={() => list.refetch()} loading={list.isRefetching}>
            <RefreshCcw size={14} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {list.error ? <Notice tone="error">{errorMessage(list.error)}</Notice> : null}

      <div className="overflow-hidden rounded-xl border border-line-subtle bg-bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="border-b border-line-subtle bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Number</th>
                <th className="px-4 py-2.5 font-semibold">Short description</th>
                <th className="px-4 py-2.5 font-semibold">Tenant / caller</th>
                <th className="px-4 py-2.5 font-semibold">Priority</th>
                <th className="px-4 py-2.5 font-semibold">State</th>
                <th className="px-4 py-2.5 font-semibold">Assigned to</th>
                <th className="px-4 py-2.5 font-semibold">SLA</th>
                <th className="px-4 py-2.5 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {rows.map((t) => (
                <tr key={t.id} className="cursor-pointer hover:bg-hover" onClick={() => navigate(`/agent/tickets/${t.id}`)}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    <Link to={`/agent/tickets/${t.id}`} className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                      {t.ref}
                    </Link>
                  </td>
                  <td className="max-w-[22rem] px-4 py-3">
                    <p className="truncate font-medium">{t.subject}</p>
                    <p className="truncate text-xs text-text-muted">
                      {CATEGORY_LABELS[t.category] ?? t.category}
                      {t.channel === 'portal' ? ' · via portal' : ''}
                    </p>
                  </td>
                  <td className="max-w-[14rem] px-4 py-3">
                    <p className="truncate">{t.organization?.name ?? '—'}</p>
                    <p className="truncate text-xs text-text-muted">{t.requesterName ?? t.requesterEmail ?? ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{t.assignee ? personName(t.assignee) : <span className="text-text-muted">Unassigned</span>}</td>
                  <td className="px-4 py-3">
                    <SlaBadge due={t.slaDueAt} done={CLOSED.includes(t.status)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-text-muted">{relativeTime(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.isLoading && rows.length === 0 ? <EmptyRow>Nothing in this queue.</EmptyRow> : null}
        {list.hasNextPage ? (
          <div className="border-t border-line-subtle p-3 text-center">
            <Button size="sm" variant="secondary" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
