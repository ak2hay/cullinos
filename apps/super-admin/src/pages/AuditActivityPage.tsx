import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input } from '@cullinos/ui';
import { superAdminApi } from '@/lib/api';

function toCsv(rows: Array<Record<string, string>>) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h] ?? '')).join(',')),
  ].join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AuditActivityPage() {
  const [page, setPage] = useState(1);
  const [organizationId, setOrganizationId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({
    organizationId: '',
    action: '',
    from: '',
    to: '',
  });

  const query = useQuery({
    queryKey: ['super-admin', 'audit-logs', page, applied],
    queryFn: () =>
      superAdminApi.listAuditLogs(page, 50, {
        organizationId: applied.organizationId || undefined,
        action: applied.action || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
      }),
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  const csv = useMemo(
    () =>
      toCsv(
        rows.map((r) => ({
          createdAt: r.createdAt,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId ?? '',
          organization: r.organization?.name ?? '',
          orgSlug: r.organization?.slug ?? '',
          actor: r.user?.email ?? '',
          metadata: JSON.stringify(r.metadata ?? {}),
        })),
      ),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Audit & activity</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Platform-wide audit log across tenants. Filter by organization, action, or date range.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={!csv}
          onClick={() => downloadCsv(`audit-logs-page-${page}.csv`, csv)}
        >
          Export CSV
        </Button>
      </div>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setApplied({ organizationId, action, from, to });
          }}
        >
          <Input
            label="Organization ID"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="Optional org id"
          />
          <Input
            label="Action contains"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g. suspend_user"
          />
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <div className="flex items-end gap-2">
            <Button type="submit">Apply</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOrganizationId('');
                setAction('');
                setFrom('');
                setTo('');
                setPage(1);
                setApplied({ organizationId: '', action: '', from: '', to: '' });
              }}
            >
              Clear
            </Button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Org</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Entity</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-muted">
                  No audit rows.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.action}</td>
                  <td className="px-4 py-3">
                    {r.organization?.name ?? '—'}
                    <span className="block text-xs text-text-muted">
                      {r.organization?.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{r.user?.email ?? '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {r.entityType}
                    {r.entityId ? (
                      <span className="block font-mono text-xs text-text-muted">{r.entityId}</span>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-white/5 px-4 py-3 text-sm">
          <span className="text-text-muted">
            {meta ? `${meta.total} total · page ${meta.page}` : ''}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!meta?.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
