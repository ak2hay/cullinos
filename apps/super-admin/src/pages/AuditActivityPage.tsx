import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { csvRow } from '@cullinos/shared';
import { Button } from '@cullinos/ui';
import { DataTable, PageHeader, SearchInput, Toolbar } from '@/components/ui';
import { inputClass } from '@/components/common';
import { superAdminApi } from '@/lib/api';

const PAGE_SIZE = 50;

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

const EMPTY_FILTERS = { organizationId: '', action: '', from: '', to: '' };

export function AuditActivityPage() {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);

  const query = useQuery({
    queryKey: ['super-admin', 'audit-logs', page, applied],
    queryFn: () =>
      superAdminApi.listAuditLogs(page, PAGE_SIZE, {
        organizationId: applied.organizationId || undefined,
        action: applied.action || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
      }),
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const hasFilters = Object.values(applied).some(Boolean);

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

  function apply() {
    setPage(1);
    setApplied(draft);
  }

  function clear() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit & activity"
        description="Platform-wide audit log across tenants. Filter by organization, action, or date range."
        actions={
          <Button type="button" variant="secondary" size="sm" disabled={!csv} onClick={() => downloadCsv(`audit-logs-page-${page}.csv`, csv)}>
            <Download size={16} aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      <DataTable
        rows={rows}
        loading={query.isLoading}
        getRowKey={(r) => r.id}
        emptyMessage={hasFilters ? 'No audit entries match these filters' : 'No audit entries yet'}
        emptyAction={
          hasFilters ? (
            <Button size="sm" variant="secondary" onClick={clear}>
              Clear filters
            </Button>
          ) : undefined
        }
        toolbar={
          <Toolbar className="w-full">
            <SearchInput
              label="Action contains"
              placeholder="Action, e.g. suspend_user"
              value={draft.action}
              onChange={(action) => setDraft({ ...draft, action })}
              onSubmit={apply}
            />
            <input
              aria-label="Organization ID"
              className={`${inputClass} h-9 w-full sm:w-56`}
              placeholder="Organization ID"
              value={draft.organizationId}
              onChange={(e) => setDraft({ ...draft, organizationId: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
            />
            <input
              aria-label="From date"
              type="date"
              className={`${inputClass} h-9 w-auto`}
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
            <span className="text-xs text-text-muted">to</span>
            <input
              aria-label="To date"
              type="date"
              className={`${inputClass} h-9 w-auto`}
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
            <Button size="sm" onClick={apply} disabled={!dirty}>
              Apply
            </Button>
            {hasFilters || dirty ? (
              <Button size="sm" variant="ghost" onClick={clear}>
                Clear
              </Button>
            ) : null}
          </Toolbar>
        }
        pagination={
          meta
            ? {
                page: meta.page,
                pageSize: PAGE_SIZE,
                total: meta.total,
                onPageChange: setPage,
                itemLabel: 'entries',
              }
            : undefined
        }
        columns={[
          {
            key: 'when',
            header: 'When',
            className: 'whitespace-nowrap text-text-secondary',
            cell: (r) => new Date(r.createdAt).toLocaleString(),
          },
          {
            key: 'action',
            header: 'Action',
            cell: (r) => <span className="rounded-md bg-bg-secondary px-2 py-0.5 font-mono text-xs text-text-primary">{r.action}</span>,
          },
          {
            key: 'org',
            header: 'Organization',
            cell: (r) => (
              <div>
                <p className="font-medium">{r.organization?.name ?? '—'}</p>
                {r.organization?.slug ? <p className="text-xs text-text-muted">{r.organization.slug}</p> : null}
              </div>
            ),
          },
          { key: 'actor', header: 'Actor', className: 'text-text-secondary', cell: (r) => r.user?.email ?? '—' },
          {
            key: 'entity',
            header: 'Entity',
            className: 'text-text-secondary',
            cell: (r) => (
              <div>
                <p>{r.entityType}</p>
                {r.entityId ? <p className="font-mono text-xs text-text-muted">{r.entityId}</p> : null}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
