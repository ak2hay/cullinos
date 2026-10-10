import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Dialog } from '@cullinos/ui';
import { DataTable, PageHeader, useConfirm } from '@/components/ui';
import { inputClass, LabeledInput, MutationError, splitList } from '@/components/common';
import { StaffPicker } from '@/components/StaffPicker';
import { useCan } from '@/lib/permissions';
import { formatDateTime, iamApi, type Assignment } from '@/lib/platform-api';

type Form = {
  user: { userId: string; label: string } | null;
  roleId: string;
  scopeType: 'global' | 'region' | 'tenant_set';
  scopeValues: string;
  expiresAt: string;
  reason: string;
};

const emptyForm: Form = { user: null, roleId: '', scopeType: 'global', scopeValues: '', expiresAt: '', reason: '' };

function scopeLabel(a: Pick<Assignment, 'scopeType' | 'scopeValues'>) {
  if (a.scopeType === 'global') return 'All tenants';
  const kind = a.scopeType === 'region' ? 'Regions' : 'Tenants';
  return `${kind}: ${a.scopeValues.slice(0, 3).join(', ')}${a.scopeValues.length > 3 ? ` +${a.scopeValues.length - 3}` : ''}`;
}

export function AssignmentsPage() {
  const [confirm, confirmDialog] = useConfirm();
  const qc = useQueryClient();
  const can = useCan();
  const canAssign = can('iam.assign');
  const [roleFilter, setRoleFilter] = useState('');
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const roles = useQuery({ queryKey: ['super-admin', 'iam', 'roles'], queryFn: iamApi.roles });
  const list = useQuery({
    queryKey: ['super-admin', 'iam', 'assignments', roleFilter, includeRevoked],
    queryFn: () => iamApi.assignments({ roleId: roleFilter || undefined, includeRevoked }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['super-admin', 'iam'] });

  const assign = useMutation({
    mutationFn: () => {
      const f = form!;
      return iamApi.assign({
        userId: f.user!.userId,
        roleId: f.roleId,
        scopeType: f.scopeType,
        scopeValues: f.scopeType === 'global' ? [] : splitList(f.scopeValues),
        expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null,
        reason: f.reason.trim() || undefined,
      });
    },
    onSuccess: () => {
      setForm(null);
      refresh();
    },
  });
  const revoke = useMutation({ mutationFn: (id: string) => iamApi.revokeAssignment(id), onSuccess: refresh });

  const assignable = (roles.data ?? []).filter((r) => r.key !== 'owner');

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title="Role assignments"
        description="Extra roles on top of each person's primary role. Scope a role to regions (tenant state) or specific tenants, and set an expiry for temporary access."
        actions={canAssign ? <Button size="sm" onClick={() => setForm(emptyForm)}>Assign role</Button> : null}
      />
      <MutationError error={revoke.error} />
      <DataTable
        rows={list.data ?? []}
        loading={list.isLoading}
        getRowKey={(a) => a.id}
        toolbar={
          <>
            <select className={`${inputClass} w-auto`} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {(roles.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={includeRevoked} onChange={(e) => setIncludeRevoked(e.target.checked)} />
              Show revoked
            </label>
          </>
        }
        columns={[
          {
            key: 'user',
            header: 'Employee',
            cell: (a) => (
              <div>
                <p className="font-medium">{a.user.name}</p>
                <p className="text-xs text-text-muted">
                  {a.user.platformEmployee?.employeeCode ?? '—'} · {a.user.email}
                </p>
              </div>
            ),
          },
          { key: 'role', header: 'Role', cell: (a) => a.role.name },
          { key: 'scope', header: 'Scope', cell: (a) => scopeLabel(a) },
          {
            key: 'expires',
            header: 'Expires',
            cell: (a) =>
              a.revokedAt ? (
                <Badge variant="error">revoked</Badge>
              ) : a.expired ? (
                <Badge variant="neutral">expired</Badge>
              ) : a.expiresAt ? (
                formatDateTime(a.expiresAt)
              ) : (
                'Never'
              ),
          },
          { key: 'reason', header: 'Reason', defaultHidden: true, cell: (a) => a.reason ?? '—' },
          { key: 'created', header: 'Granted', cell: (a) => formatDateTime(a.createdAt) },
          {
            key: 'actions',
            header: '',
            cell: (a) =>
              canAssign && !a.revokedAt ? (
                <button
                  type="button"
                  className="text-xs text-status-error hover:underline"
                  onClick={() => void confirm({ title: `Revoke ${a.role.name} from ${a.user.name}?` }).then((ok) => ok && revoke.mutate(a.id))}
                >
                  Revoke
                </button>
              ) : null,
          },
        ]}
        columnChooser
      />

      <Dialog
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title="Assign role"
        description="Critical roles go through approval before they apply."
        footer={
          <Button size="sm" loading={assign.isPending} disabled={!form?.user || !form?.roleId} onClick={() => assign.mutate()}>
            Assign
          </Button>
        }
      >
        {form ? (
          <div className="space-y-3">
            <LabeledInput label="Employee">
              <StaffPicker value={form.user} onChange={(user) => setForm({ ...form, user })} />
            </LabeledInput>
            <LabeledInput label="Role">
              <select className={inputClass} value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                <option value="">Select…</option>
                {assignable.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.maxRisk ?? 'low'} risk)
                  </option>
                ))}
              </select>
            </LabeledInput>
            <LabeledInput label="Scope">
              <select
                className={inputClass}
                value={form.scopeType}
                onChange={(e) => setForm({ ...form, scopeType: e.target.value as Form['scopeType'] })}
              >
                <option value="global">All tenants</option>
                <option value="region">Regions (tenant state)</option>
                <option value="tenant_set">Specific tenants</option>
              </select>
            </LabeledInput>
            {form.scopeType !== 'global' ? (
              <LabeledInput
                label={form.scopeType === 'region' ? 'Regions' : 'Tenant IDs'}
                hint="Comma or newline separated. Only tenant-level permissions (like viewing or suspending tenants) are scoped; others are ignored."
              >
                <textarea className={inputClass} value={form.scopeValues} onChange={(e) => setForm({ ...form, scopeValues: e.target.value })} />
              </LabeledInput>
            ) : null}
            <LabeledInput label="Expires (optional)">
              <input
                type="datetime-local"
                className={inputClass}
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </LabeledInput>
            <LabeledInput label="Reason">
              <input className={inputClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </LabeledInput>
            <MutationError error={assign.error} />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
