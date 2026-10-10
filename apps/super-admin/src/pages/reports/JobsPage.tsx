import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@cullinos/ui';
import { DataTable, PageHeader, SectionCard, StatusPill } from '@/components/ui';
import { inputClass, LabeledInput, MutationError, Notice, splitList } from '@/components/common';
import { useCan } from '@/lib/permissions';
import { downloadCsv, formatDateTime, reportsApi, type ExportKind, type Job } from '@/lib/platform-api';

const EXPORTS: { kind: ExportKind; label: string; permission?: 'activity.export' }[] = [
  { kind: 'tenants', label: 'Tenants (contact details, plan)' },
  { kind: 'tenant_users', label: 'Tenant users (names, emails, phones)' },
  { kind: 'tickets', label: 'Support tickets' },
  { kind: 'activity', label: 'Staff activity log', permission: 'activity.export' },
];

function jobOutcome(j: Job) {
  if (j.status === 'pending_approval') return 'Waiting for approval';
  if (j.kind === 'export') return j.status === 'completed' ? `${j.total} rows` : '';
  return `${j.processed}/${j.total} done${j.failed ? ` · ${j.failed} failed` : ''}`;
}

export function JobsPage() {
  const qc = useQueryClient();
  const can = useCan();
  const location = useLocation();
  const preselected = (location.state as { organizationIds?: string[] } | null)?.organizationIds ?? [];
  const [exportKind, setExportKind] = useState<ExportKind>('tenants');
  const [exportWhy, setExportWhy] = useState('');
  const [bulkAction, setBulkAction] = useState<'suspend' | 'reactivate'>('suspend');
  const [bulkIds, setBulkIds] = useState(preselected.join('\n'));
  const [bulkReason, setBulkReason] = useState('');
  const jobs = useQuery({
    queryKey: ['super-admin', 'jobs'],
    queryFn: reportsApi.jobs,
    refetchInterval: (q) => (q.state.data?.some((j) => j.status === 'running' || j.status === 'queued') ? 3000 : 30_000),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['super-admin', 'jobs'] });

  const createExport = useMutation({
    mutationFn: () => reportsApi.createExport({ exportKind, justification: exportWhy.trim() || undefined }),
    onSuccess: () => {
      setExportWhy('');
      refresh();
    },
  });
  const createBulk = useMutation({
    mutationFn: () =>
      reportsApi.createBulk({ action: bulkAction, organizationIds: splitList(bulkIds), reason: bulkReason.trim(), justification: bulkReason.trim() }),
    onSuccess: () => {
      setBulkIds('');
      setBulkReason('');
      refresh();
    },
  });
  const download = useMutation({
    mutationFn: (id: string) => reportsApi.download(id),
    onSuccess: (r) => downloadCsv(r.filename, r.csv),
  });
  const cancel = useMutation({ mutationFn: (id: string) => reportsApi.cancel(id), onSuccess: refresh });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exports & bulk jobs"
        description="Exports with customer data and bulk tenant changes run in the background after approval. Only the requester can download a result."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {can('reports.export') ? (
          <SectionCard title="New export">
            <div className="space-y-3">
              <LabeledInput label="Data">
                <select className={inputClass} value={exportKind} onChange={(e) => setExportKind(e.target.value as ExportKind)}>
                  {EXPORTS.filter((x) => !x.permission || can(x.permission)).map((x) => (
                    <option key={x.kind} value={x.kind}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </LabeledInput>
              <LabeledInput label="Purpose" hint="Required when the export needs approval (min 8 characters).">
                <input className={inputClass} value={exportWhy} onChange={(e) => setExportWhy(e.target.value)} />
              </LabeledInput>
              <Button size="sm" loading={createExport.isPending} onClick={() => createExport.mutate()}>
                Request export
              </Button>
              {createExport.data?.status === 'pending_approval' ? <Notice tone="info">Sent for approval. It runs once approved.</Notice> : null}
              <MutationError error={createExport.error} />
            </div>
          </SectionCard>
        ) : null}
        {can('bulk.run') ? (
          <SectionCard title="Bulk tenant action">
            <div className="space-y-3">
              <LabeledInput label="Action">
                <select className={inputClass} value={bulkAction} onChange={(e) => setBulkAction(e.target.value as 'suspend' | 'reactivate')}>
                  <option value="suspend">Suspend</option>
                  <option value="reactivate">Reactivate</option>
                </select>
              </LabeledInput>
              <LabeledInput label="Tenant IDs" hint={`One per line or comma separated · ${splitList(bulkIds).length} selected · max 1000. Select on the Tenants page to prefill.`}>
                <textarea className={`${inputClass} min-h-24 font-mono text-xs`} value={bulkIds} onChange={(e) => setBulkIds(e.target.value)} />
              </LabeledInput>
              <LabeledInput label="Reason" hint="Shown to approvers and written to each tenant's audit log.">
                <input className={inputClass} value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
              </LabeledInput>
              <Button
                size="sm"
                variant={bulkAction === 'suspend' ? 'danger' : 'primary'}
                loading={createBulk.isPending}
                disabled={!splitList(bulkIds).length || bulkReason.trim().length < 8}
                onClick={() => createBulk.mutate()}
              >
                Request bulk {bulkAction}
              </Button>
              <MutationError error={createBulk.error} />
            </div>
          </SectionCard>
        ) : null}
      </div>

      <MutationError error={download.error ?? cancel.error} />
      <DataTable
        rows={jobs.data ?? []}
        loading={jobs.isLoading}
        getRowKey={(j) => j.id}
        emptyMessage="No jobs yet."
        columns={[
          { key: 'what', header: 'Job', cell: (j) => <span className="font-medium">{j.kind === 'export' ? `Export ${j.action.replace('_', ' ')}` : `Bulk ${j.action}`}</span> },
          { key: 'status', header: 'Status', cell: (j) => <StatusPill status={j.status} /> },
          {
            key: 'progress',
            header: 'Progress',
            cell: (j) => (
              <div className="w-40">
                {j.total && j.kind === 'bulk_action' ? (
                  <div className="h-1.5 rounded-full bg-hover-strong">
                    <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.round((j.processed / j.total) * 100)}%` }} />
                  </div>
                ) : null}
                <p className="mt-1 text-xs text-text-muted">{jobOutcome(j)}</p>
              </div>
            ),
          },
          { key: 'created', header: 'Requested', cell: (j) => formatDateTime(j.createdAt) },
          { key: 'finished', header: 'Finished', cell: (j) => formatDateTime(j.finishedAt) },
          {
            key: 'x',
            header: '',
            cell: (j) => (
              <div className="flex gap-3 text-xs">
                {j.kind === 'export' && j.status === 'completed' ? (
                  <button type="button" className="text-accent hover:underline" onClick={() => download.mutate(j.id)}>
                    Download
                  </button>
                ) : null}
                {j.approvalRequestId ? (
                  <Link to={`/approvals/${j.approvalRequestId}`} className="text-text-secondary hover:underline">
                    Approval
                  </Link>
                ) : null}
                {['pending_approval', 'queued', 'running'].includes(j.status) ? (
                  <button type="button" className="text-status-error hover:underline" onClick={() => cancel.mutate(j.id)}>
                    Cancel
                  </button>
                ) : null}
                {j.errors?.length ? (
                  <span className="text-status-error" title={j.errors.map((e) => `${e.organizationId ?? ''} ${e.message ?? ''}`).join('\n')}>
                    {j.errors.length} error(s)
                  </span>
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
