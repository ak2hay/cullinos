import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { csvRow } from '@cullinos/shared';
import { Button } from '@cullinos/ui';
import { inputClass } from '@/components/common';
import { DataTable, EntityAvatar, FilterSelect, FilterTabs, PageHeader, SearchInput, StatusPill } from '@/components/ui';
import { superAdminApi } from '@/lib/api';
import { relativeTime } from '@/lib/format';

function toCsv(rows: Array<Record<string, string>>) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  return [csvRow(headers), ...rows.map((r) => csvRow(headers.map((h) => r[h] ?? '')))].join('\n');
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

type StatusTab = '' | 'active' | 'inactive' | 'invited';

export function UsersReportPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusTab>('');
  const [organizationId, setOrganizationId] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery({
    queryKey: ['super-admin', 'users-report', page, pageSize, q, status, organizationId],
    queryFn: () =>
      superAdminApi.listUsers({
        page,
        limit: pageSize,
        q: q || undefined,
        status: status || undefined,
        organizationId: organizationId.trim() || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const tenants = useQuery({
    queryKey: ['super-admin', 'organizations', 'picker'],
    queryFn: () => superAdminApi.listOrganizations(1, 200),
  });

  const rows = query.data?.data ?? [];
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
      <PageHeader
        title="Users"
        description="Tenant staff accounts across all organizations."
        actions={
          <Button size="sm" variant="secondary" className="gap-2" disabled={!csv} onClick={() => downloadCsv(`users-report-page-${page}.csv`, csv)}>
            <Download size={15} aria-hidden="true" />
            Export page
          </Button>
        }
      />

      <DataTable
        rows={rows}
        loading={query.isLoading}
        getRowKey={(r) => r.id}
        emptyMessage="No users found"
        header={
          <FilterTabs<StatusTab>
            label="User status"
            value={status}
            onChange={(s) => {
              setStatus(s);
              setPage(1);
            }}
            tabs={[
              { id: '', label: 'All users' },
              { id: 'active', label: 'Active' },
              { id: 'invited', label: 'Invited' },
              { id: 'inactive', label: 'Suspended' },
            ]}
          />
        }
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Name, email, phone…" />
            {tenants.data && tenants.data.meta.total <= 200 ? (
              <FilterSelect
                aria-label="Organization"
                value={organizationId}
                onChange={(e) => {
                  setOrganizationId(e.target.value);
                  setPage(1);
                }}
                className="max-w-56"
                options={[{ value: '', label: 'All organizations' }, ...tenants.data.data.map((t) => ({ value: t.id, label: t.name }))]}
              />
            ) : (
              <input
                className={`${inputClass} h-9 w-56 py-0`}
                placeholder="Organization ID"
                value={organizationId}
                onChange={(e) => {
                  setOrganizationId(e.target.value);
                  setPage(1);
                }}
              />
            )}
          </>
        }
        columns={[
          {
            key: 'user',
            header: 'User',
            cell: (r) => (
              <div className="flex items-center gap-3">
                <EntityAvatar name={r.name} seed={r.id} size={32} rounded="full" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="truncate text-xs text-text-muted">{r.email}</p>
                </div>
              </div>
            ),
          },
          { key: 'phone', header: 'Phone', cell: (r) => r.phone ?? '—', defaultHidden: true },
          {
            key: 'org',
            header: 'Organization',
            cell: (r) => (
              <Link to={`/tenants/${r.organization.id}`} className="group" onClick={(e) => e.stopPropagation()}>
                <span className="block font-medium group-hover:text-accent">{r.organization.name}</span>
                <span className="block text-xs text-text-muted">{r.organization.slug}</span>
              </Link>
            ),
          },
          { key: 'status', header: 'Status', cell: (r) => <StatusPill status={r.status === 'inactive' ? 'suspended' : r.status} /> },
          {
            key: 'login',
            header: 'Last login',
            cell: (r) => (
              <span className="text-text-secondary" title={r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString() : undefined}>
                {r.lastLoginAt ? relativeTime(r.lastLoginAt) : 'Never'}
              </span>
            ),
          },
        ]}
        pagination={{
          page,
          pageSize,
          total: query.data?.meta.total ?? 0,
          onPageChange: setPage,
          onPageSizeChange: (n) => {
            setPageSize(n);
            setPage(1);
          },
          pageSizeOptions: [25, 50, 100],
          itemLabel: 'users',
        }}
      />
    </div>
  );
}
