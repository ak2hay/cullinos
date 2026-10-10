import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Drawer } from '@cullinos/ui';
import { DataTable, PageHeader } from '@/components/ui';
import { inputClass, LabeledInput, MutationError } from '@/components/common';
import { useCan } from '@/lib/permissions';
import { approvalsApi, iamApi, type ApprovalPolicy } from '@/lib/platform-api';

type Draft = ApprovalPolicy & { conditionsText: string };

export function ApprovalPoliciesPage() {
  const qc = useQueryClient();
  const can = useCan();
  const canEdit = can('approvals.policies');
  const policies = useQuery({ queryKey: ['super-admin', 'approval-policies'], queryFn: approvalsApi.policies });
  const roles = useQuery({ queryKey: ['super-admin', 'iam', 'roles'], queryFn: iamApi.roles, enabled: canEdit });
  const teams = useQuery({ queryKey: ['super-admin', 'iam', 'teams'], queryFn: iamApi.teams, enabled: canEdit });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [conditionsError, setConditionsError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const d = draft!;
      let conditions: ApprovalPolicy['conditions'] = null;
      if (d.conditionsText.trim()) conditions = JSON.parse(d.conditionsText) as ApprovalPolicy['conditions'];
      return approvalsApi.updatePolicy(d.id, {
        name: d.name,
        description: d.description,
        requiredApprovals: d.requiredApprovals,
        approverRoleKeys: d.approverRoleKeys,
        approverTeamIds: d.approverTeamIds,
        blockSelfApproval: d.blockSelfApproval,
        expiryHours: d.expiryHours,
        conditions,
        isActive: d.isActive,
      });
    },
    onSuccess: () => {
      setDraft(null);
      qc.invalidateQueries({ queryKey: ['super-admin', 'approval-policies'] });
    },
  });

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval policies"
        description="Which actions need a second (or third) pair of eyes, who may approve, and when the request expires. Owners can always approve."
      />
      <DataTable
        rows={policies.data ?? []}
        loading={policies.isLoading}
        getRowKey={(p) => p.id}
        onRowClick={(p) => {
          setConditionsError(null);
          setDraft({ ...p, conditionsText: p.conditions?.length ? JSON.stringify(p.conditions, null, 2) : '' });
        }}
        columns={[
          {
            key: 'name',
            header: 'Action',
            cell: (p) => (
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="font-mono text-[11px] text-text-muted">{p.actionKey}</p>
              </div>
            ),
          },
          { key: 'active', header: 'Status', cell: (p) => <Badge variant={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Required' : 'Off'}</Badge> },
          { key: 'n', header: 'Approvers needed', cell: (p) => p.requiredApprovals },
          {
            key: 'who',
            header: 'Who approves',
            cell: (p) => [...p.approverRoleKeys, ...(p.approverTeamIds.length ? [`${p.approverTeamIds.length} team(s)`] : [])].join(', ') || 'Owners',
          },
          { key: 'cond', header: 'Conditions', cell: (p) => (p.conditions?.length ? `${p.conditions.length} rule(s)` : 'Always') },
          { key: 'exp', header: 'Expires after', cell: (p) => `${p.expiryHours} h` },
        ]}
      />

      <Drawer
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.name}
        description={draft?.actionKey}
        width="lg"
        footer={
          canEdit ? (
            <Button
              size="sm"
              loading={save.isPending}
              onClick={() => {
                try {
                  if (draft?.conditionsText.trim()) JSON.parse(draft.conditionsText);
                  setConditionsError(null);
                  save.mutate();
                } catch {
                  setConditionsError('Conditions must be valid JSON');
                }
              }}
            >
              Save policy
            </Button>
          ) : null
        }
      >
        {draft ? (
          <fieldset disabled={!canEdit} className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              Approval required for this action
            </label>
            <LabeledInput label="Approvals needed">
              <input
                type="number"
                min={1}
                max={5}
                className={inputClass}
                value={draft.requiredApprovals}
                onChange={(e) => setDraft({ ...draft, requiredApprovals: Number(e.target.value) })}
              />
            </LabeledInput>
            <LabeledInput label="Approver roles">
              <div className="flex flex-wrap gap-2">
                {(roles.data ?? []).map((r) => (
                  <label key={r.key} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={draft.approverRoleKeys.includes(r.key)}
                      onChange={() => setDraft({ ...draft, approverRoleKeys: toggle(draft.approverRoleKeys, r.key) })}
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </LabeledInput>
            <LabeledInput label="Approver teams">
              <div className="flex flex-wrap gap-2">
                {(teams.data ?? []).map((t) => (
                  <label key={t.id} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={draft.approverTeamIds.includes(t.id)}
                      onChange={() => setDraft({ ...draft, approverTeamIds: toggle(draft.approverTeamIds, t.id) })}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </LabeledInput>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.blockSelfApproval}
                onChange={(e) => setDraft({ ...draft, blockSelfApproval: e.target.checked })}
              />
              Requester cannot approve their own request
            </label>
            <LabeledInput label="Expires after (hours)">
              <input
                type="number"
                min={1}
                max={720}
                className={inputClass}
                value={draft.expiryHours}
                onChange={(e) => setDraft({ ...draft, expiryHours: Number(e.target.value) })}
              />
            </LabeledInput>
            <LabeledInput
              label="Conditions (JSON, optional)"
              hint='Only require approval when all rules match, e.g. [{"field":"amountPaise","op":"abs_gt","value":5000000}]. Ops: gt, gte, lt, lte, eq, neq, in, abs_gt.'
            >
              <textarea
                className={`${inputClass} min-h-28 font-mono text-xs`}
                value={draft.conditionsText}
                onChange={(e) => setDraft({ ...draft, conditionsText: e.target.value })}
              />
            </LabeledInput>
            {conditionsError ? <p className="text-sm text-status-error">{conditionsError}</p> : null}
            <MutationError error={save.error} />
          </fieldset>
        ) : null}
      </Drawer>
    </div>
  );
}
