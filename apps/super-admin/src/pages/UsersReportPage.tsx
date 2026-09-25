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

export function UsersReportPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [applied, setApplied] = useState({ q: '', status: '', organizationId: '' });

  const query = useQuery({
    queryKey: ['super-admin', 'users-report', page, applied],
    queryFn: () =>
      superAdminApi.listUsers({
        page,
        limit: 50,
        q: applied.q || undefined,
        status: applied.status || undefined,
        organizationId: applied.organizationId || undefined,
      }),
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  const csv = useMemo(
    () =>
      toCsv(
        rows.map((r) => ({
          name: r.name,
          email: r.email,
          phone: r.phone ?? '',
          status: r.status,
          organization: r.organization.name,
          orgSlug: r.organization.slug,
          lastLoginAt: r.lastLoginAt ?? '',
          createdAt: r.createdAt,
        })),
      ),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users report</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Tenant staff across all organizations. Export the current page as CSV.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={!csv}
          onClick={() => downloadCsv(`users-report-page-${page}.csv`, csv)}
        >
          Export CSV
        </Button>
      </div>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setApplied({ q, status, organizationId });
          }}
        >
          <Input
            label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, phone"
          />
          <label className="block text-sm">
            <span className="text-text-muted">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 outline-none focus:border-brand-accent"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive / suspended</option>
              <option value="invited">Invited</option>
            </select>
          </label>
          <Input
            label="Organization ID"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="Optional"
          />
          <div className="flex items-end gap-2">
            <Button type="submit">Apply</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQ('');
                setStatus('');
                setOrganizationId('');
                setPage(1);
                setApplied({ q: '', status: '', organizationId: '' });
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
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last login</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-text-muted">
                  No users found.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-text-muted">{r.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {r.organization.name}
                    <span className="block text-xs text-text-muted">{r.organization.slug}</span>
                  </td>
                  <td className="px-4 py-3 capitalize">{r.status}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString() : '—'}
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
