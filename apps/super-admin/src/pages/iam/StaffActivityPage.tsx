import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Drawer } from '@cullinos/ui';
import { DataTable, PageHeader } from '@/components/ui';
import { inputClass, MutationError, Notice } from '@/components/common';
import { SavedViews } from '@/components/SavedViews';
import { useCan } from '@/lib/permissions';
import { downloadCsv, formatDateTime, iamApi, type ActivityRow } from '@/lib/platform-api';

const FILTER_KEYS = ['employeeCode', 'action', 'targetOrgId', 'ticketId', 'grantId', 'from', 'to'] as const;

export function StaffActivityPage() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<string, string>;
  const [draft, setDraft] = useState(filters);
  const [selected, setSelected] = useState<ActivityRow | null>(null);

  const query = useInfiniteQuery({
    queryKey: ['super-admin', 'activity', filters],
    queryFn: ({ pageParam }) =>
      iamApi.activity({
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to: filters.to ? new Date(filters.to).toISOString() : undefined,
        cursor: pageParam ?? undefined,
        limit: 50,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];

  const verify = useMutation({ mutationFn: iamApi.verifyActivity });
  const exportCsv = useMutation({
    mutationFn: () =>
      iamApi.exportActivity({
        employeeCode: filters.employeeCode || undefined,
        action: filters.action || undefined,
        targetOrgId: filters.targetOrgId || undefined,
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to: filters.to ? new Date(filters.to).toISOString() : undefined,
      }),
    onSuccess: (res) => downloadCsv(`staff-activity-${new Date().toISOString().slice(0, 10)}.csv`, res.csv),
  });

  function apply(next: Record<string, string>) {
    setDraft(next);
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff activity log"
        description="Every request any Rkyves employee makes on this portal (reads included) and every action inside a tenant support session, tagged with their employee ID. Append-only and hash-chained."
        actions={
          <>
            <Button size="sm" variant="secondary" loading={verify.isPending} onClick={() => verify.mutate()}>
              Verify integrity
            </Button>
            {can('activity.export') ? (
              <Button size="sm" loading={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
                Export CSV
              </Button>
            ) : null}
          </>
        }
      />
      {verify.data ? (
        <Notice tone={verify.data.ok ? 'success' : 'error'}>
          {verify.data.ok
            ? `Chain intact: last ${verify.data.checked} entries verified.`
            : `Tampering detected at entry ${verify.data.brokenAt} (after ${verify.data.checked} good entries).`}
        </Notice>
      ) : null}
      <MutationError error={exportCsv.error ?? verify.error} />

      <div className="grid gap-3 rounded-xl border border-line-subtle bg-bg-card p-4 md:grid-cols-4">
        <input className={inputClass} placeholder="Employee ID (RKY-…)" value={draft.employeeCode} onChange={(e) => setDraft({ ...draft, employeeCode: e.target.value })} />
        <input className={inputClass} placeholder="Action contains…" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} />
        <input className={inputClass} placeholder="Tenant ID" value={draft.targetOrgId} onChange={(e) => setDraft({ ...draft, targetOrgId: e.target.value })} />
        <input className={inputClass} placeholder="Ticket ID" value={draft.ticketId} onChange={(e) => setDraft({ ...draft, ticketId: e.target.value })} />
        <input type="datetime-local" className={inputClass} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        <input type="datetime-local" className={inputClass} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        <div className="flex gap-2 md:col-span-2">
          <Button size="sm" onClick={() => apply(draft)}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => apply(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])))}>
            Clear
          </Button>
        </div>
        <div className="md:col-span-4">
          <SavedViews page="activity" filters={filters} onApply={apply} />
        </div>
      </div>

      <DataTable
        rows={rows}
        loading={query.isLoading}
        getRowKey={(r) => r.id}
        onRowClick={setSelected}
        hasMore={query.hasNextPage}
        onLoadMore={() => query.fetchNextPage()}
        loadingMore={query.isFetchingNextPage}
        columnChooser
        columns={[
          { key: 'when', header: 'When', cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt)}</span> },
          {
            key: 'who',
            header: 'Employee',
            cell: (r) => (
              <div>
                <p className="font-mono text-xs">{r.employeeCode ?? '—'}</p>
                <p className="text-xs text-text-muted">{r.actorEmail}</p>
              </div>
            ),
          },
          {
            key: 'action',
            header: 'Action',
            cell: (r) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{r.action}</span>
                {r.grantId ? <Badge variant="warning">support session</Badge> : null}
                {r.approvalRequestId ? <Badge variant="info">approved</Badge> : null}
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            cell: (r) =>
              r.statusCode ? (
                <Badge variant={r.statusCode >= 400 ? 'error' : 'success'}>{r.statusCode}</Badge>
              ) : (
                '—'
              ),
          },
          { key: 'tenant', header: 'Tenant', cell: (r) => <span className="font-mono text-xs">{r.targetOrgId ?? '—'}</span> },
          { key: 'ip', header: 'IP', defaultHidden: true, cell: (r) => r.ip ?? '—' },
          { key: 'seq', header: '#', defaultHidden: true, cell: (r) => r.seq },
        ]}
      />

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={`Entry #${selected?.seq ?? ''}`} width="xl">
        {selected ? (
          <dl className="space-y-3 text-sm">
            {(
              [
                ['When', formatDateTime(selected.createdAt)],
                ['Employee', `${selected.employeeCode ?? '—'} · ${selected.actorEmail ?? ''}`],
                ['Action', selected.action],
                ['Route', `${selected.method ?? ''} ${selected.route ?? ''}`],
                ['Status', selected.statusCode ?? '—'],
                ['Resource', `${selected.resourceType ?? '—'} ${selected.resourceId ?? ''}`],
                ['Tenant', selected.targetOrgId ?? '—'],
                ['Ticket / grant', `${selected.ticketId ?? '—'} / ${selected.grantId ?? '—'}`],
                ['Approval', selected.approvalRequestId ?? '—'],
                ['IP', selected.ip ?? '—'],
                ['Hash', selected.hash],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-text-muted">{k}</dt>
                <dd className="break-all font-mono text-xs">{String(v)}</dd>
              </div>
            ))}
            {selected.diff ? (
              <div>
                <dt className="text-xs text-text-muted">Request body (redacted)</dt>
                <dd>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-bg-elevated p-3 text-xs">{JSON.stringify(selected.diff, null, 2)}</pre>
                </dd>
              </div>
            ) : null}
            {selected.metadata ? (
              <div>
                <dt className="text-xs text-text-muted">Metadata</dt>
                <dd>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-bg-elevated p-3 text-xs">{JSON.stringify(selected.metadata, null, 2)}</pre>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Drawer>
    </div>
  );
}
