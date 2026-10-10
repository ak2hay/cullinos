import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog } from '@cullinos/ui';
import { DataTable, PageHeader, StatusPill } from '@/components/ui';
import { inputClass, LabeledInput, MutationError } from '@/components/common';
import { formatDateTime, iamApi, securityApi } from '@/lib/platform-api';

type Form = { name: string; dueAt: string; departmentId: string; teamId: string; includePrimaryRoles: boolean };

export function AccessReviewsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const campaigns = useQuery({ queryKey: ['super-admin', 'review-campaigns'], queryFn: securityApi.campaigns });
  const departments = useQuery({ queryKey: ['super-admin', 'iam', 'departments'], queryFn: iamApi.departments });
  const teams = useQuery({ queryKey: ['super-admin', 'iam', 'teams'], queryFn: iamApi.teams });
  const [form, setForm] = useState<Form | null>(null);
  const create = useMutation({
    mutationFn: () => {
      const f = form!;
      return securityApi.createCampaign({
        name: f.name.trim(),
        dueAt: new Date(f.dueAt).toISOString(),
        departmentId: f.departmentId || undefined,
        teamId: f.teamId || undefined,
        includePrimaryRoles: f.includePrimaryRoles,
      });
    },
    onSuccess: (c) => {
      setForm(null);
      qc.invalidateQueries({ queryKey: ['super-admin', 'review-campaigns'] });
      navigate(`/access/reviews/${c.id}`);
    },
  });

  const inTwoWeeks = new Date(Date.now() + 14 * 24 * 3600_000).toISOString().slice(0, 16);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access reviews"
        description="Periodic certification: each manager confirms or removes their reports' roles. Anything not reviewed by close is revoked automatically."
        actions={
          <Button
            size="sm"
            onClick={() => setForm({ name: `Quarterly review ${new Date().toLocaleDateString()}`, dueAt: inTwoWeeks, departmentId: '', teamId: '', includePrimaryRoles: true })}
          >
            Start campaign
          </Button>
        }
      />
      <DataTable
        rows={campaigns.data ?? []}
        loading={campaigns.isLoading}
        getRowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/access/reviews/${c.id}`)}
        columns={[
          { key: 'name', header: 'Campaign', cell: (c) => <span className="font-medium">{c.name}</span> },
          { key: 'status', header: 'Status', cell: (c) => <StatusPill status={c.status} /> },
          {
            key: 'progress',
            header: 'Progress',
            cell: (c) => (
              <div className="w-40">
                <div className="h-1.5 rounded-full bg-hover-strong">
                  <div className="h-1.5 rounded-full bg-accent" style={{ width: `${c.progress.percentDone}%` }} />
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {c.progress.total - c.progress.pending}/{c.progress.total} · {c.progress.revoked} revoked
                </p>
              </div>
            ),
          },
          { key: 'due', header: 'Due', cell: (c) => formatDateTime(c.dueAt) },
          { key: 'created', header: 'Started', cell: (c) => formatDateTime(c.createdAt) },
        ]}
      />
      <Dialog
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title="Start access review"
        footer={
          <Button size="sm" loading={create.isPending} disabled={!form?.name.trim() || !form?.dueAt} onClick={() => create.mutate()}>
            Start
          </Button>
        }
      >
        {form ? (
          <div className="space-y-3">
            <LabeledInput label="Name">
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Due">
              <input type="datetime-local" className={inputClass} value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Department (optional)">
              <select className={inputClass} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">Everyone</option>
                {(departments.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </LabeledInput>
            <LabeledInput label="Team (optional)">
              <select className={inputClass} value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                <option value="">All teams</option>
                {(teams.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </LabeledInput>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.includePrimaryRoles} onChange={(e) => setForm({ ...form, includePrimaryRoles: e.target.checked })} />
              Also review primary roles (revoking downgrades to Viewer)
            </label>
            <MutationError error={create.error} />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
