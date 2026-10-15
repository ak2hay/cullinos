import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyRow, Notice, inputClass } from '@/components/common';
import { GrantActions } from '@/components/TenantAccess';
import { errorMessage } from '@/lib/api';
import { formatDateTime, personName } from '@/lib/format';
import { agentApi } from '@/lib/support-api';

const STATUSES = ['pending', 'active', 'expired', 'revoked', 'rejected'] as const;

export function AgentGrantsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'active';
  const mine = params.get('mine') === 'true';
  const query = useQuery({
    queryKey: ['agent', 'access-grants', status, mine],
    queryFn: () => agentApi.grants({ status: status || undefined, mine }),
    refetchInterval: 30_000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['agent', 'access-grants'] });
  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Tenant access grants</h1>
          <p className="text-sm text-text-secondary">
            Who can open which restaurant account, under which ticket, and until when. Request access from a ticket; resolving the ticket ends it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className={`${inputClass} w-40`}
            value={status}
            aria-label="Status"
            onChange={(e) => setParams({ status: e.target.value, ...(mine ? { mine: 'true' } : {}) })}
          >
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={mine} onChange={(e) => setParams({ status, ...(e.target.checked ? { mine: 'true' } : {}) })} />
            Only mine
          </label>
        </div>
      </div>

      {query.error ? <Notice tone="error">{errorMessage(query.error)}</Notice> : null}

      <div className="overflow-hidden rounded-xl border border-line-subtle bg-bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-line-subtle bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Employee</th>
                <th className="px-4 py-2.5 font-semibold">Tenant</th>
                <th className="px-4 py-2.5 font-semibold">Ticket</th>
                <th className="px-4 py-2.5 font-semibold">Level</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Until</th>
                <th className="px-4 py-2.5 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {rows.map((g) => (
                <tr key={g.id} className="align-top">
                  <td className="px-4 py-3">{personName(g.employee)}</td>
                  <td className="px-4 py-3">{g.organization?.name ?? g.organizationId}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    <Link to={`/agent/tickets/${g.ticketId}`} className="text-accent hover:underline">
                      {g.ticketRef}
                    </Link>
                  </td>
                  <td className="px-4 py-3 capitalize">{g.accessLevel.replace('_', '-')}</td>
                  <td className="px-4 py-3 capitalize">{g.status}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDateTime(g.expiresAt)}</td>
                  <td className="px-4 py-3">
                    <GrantActions grant={g} onChange={refresh} showPassword={false} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!query.isLoading && rows.length === 0 ? <EmptyRow>No grants match.</EmptyRow> : null}
      </div>
    </div>
  );
}
