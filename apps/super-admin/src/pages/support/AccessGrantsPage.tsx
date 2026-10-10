import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@cullinos/ui';
import { DataTable, PageHeader, StatusPill } from '@/components/ui';
import { inputClass } from '@/components/common';
import { formatDateTime, personLabel, supportApi } from '@/lib/platform-api';
import { GrantActions } from './TicketDetailPage';

export function AccessGrantsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'active';
  const mine = params.get('mine') === 'true';
  const key = ['super-admin', 'access-grants', status, mine];
  const query = useQuery({
    queryKey: key,
    queryFn: () => supportApi.grants({ status: status || undefined, mine }),
    refetchInterval: 30_000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['super-admin', 'access-grants'] });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant access grants"
        description="Who can open which restaurant account right now, under which ticket, and until when. Request access from a ticket; resolving the ticket ends it."
      />
      <DataTable
        rows={query.data ?? []}
        loading={query.isLoading}
        getRowKey={(g) => g.id}
        toolbar={
          <>
            <select
              className={`${inputClass} w-auto`}
              value={status}
              onChange={(e) => setParams({ status: e.target.value, ...(mine ? { mine: 'true' } : {}) })}
            >
              <option value="">Any status</option>
              {['pending', 'active', 'expired', 'revoked', 'rejected'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={mine}
                onChange={(e) => setParams({ status, ...(e.target.checked ? { mine: 'true' } : {}) })}
              />
              Only mine
            </label>
          </>
        }
        columns={[
          { key: 'employee', header: 'Employee', cell: (g) => personLabel(g.employee) },
          {
            key: 'tenant',
            header: 'Tenant',
            cell: (g) =>
              g.organization ? (
                <Link to={`/tenants/${g.organization.id}`} className="text-accent hover:underline">
                  {g.organization.name}
                </Link>
              ) : (
                g.organizationId
              ),
          },
          {
            key: 'ticket',
            header: 'Ticket',
            cell: (g) => (
              <Link to={`/support/tickets/${g.ticketId}`} className="font-mono text-xs text-accent hover:underline">
                {g.ticketRef}
              </Link>
            ),
          },
          { key: 'level', header: 'Level', cell: (g) => <Badge variant={g.accessLevel === 'full' ? 'warning' : 'neutral'}>{g.accessLevel.replace('_', '-')}</Badge> },
          { key: 'status', header: 'Status', cell: (g) => <StatusPill status={g.status} /> },
          { key: 'expires', header: 'Until', cell: (g) => formatDateTime(g.expiresAt) },
          { key: 'used', header: 'Last opened', defaultHidden: true, cell: (g) => formatDateTime(g.lastUsedAt) },
          { key: 'why', header: 'Justification', defaultHidden: true, cell: (g) => <span className="line-clamp-2 text-xs">{g.justification}</span> },
          { key: 'actions', header: '', cell: (g) => <GrantActions grant={g} onChange={refresh} /> },
        ]}
        columnChooser
      />
    </div>
  );
}
