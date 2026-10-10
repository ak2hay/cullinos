import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Dialog } from '@cullinos/ui';
import { PageHeader, SectionCard, useConfirm } from '@/components/ui';
import { inputClass, LabeledInput, MutationError, splitList } from '@/components/common';
import { useCan } from '@/lib/permissions';
import { iamApi, type Department, type Team } from '@/lib/platform-api';

type TeamForm = {
  id?: string;
  departmentId: string;
  name: string;
  code: string;
  parentId: string;
  description: string;
  ipAllowlist: string;
};

const emptyTeam: TeamForm = { departmentId: '', name: '', code: '', parentId: '', description: '', ipAllowlist: '' };

export function OrgStructurePage() {
  const [confirm, confirmDialog] = useConfirm();
  const qc = useQueryClient();
  const can = useCan();
  const canManage = can('iam.manage');
  const departments = useQuery({ queryKey: ['super-admin', 'iam', 'departments'], queryFn: iamApi.departments });
  const teams = useQuery({ queryKey: ['super-admin', 'iam', 'teams'], queryFn: iamApi.teams });
  const refresh = () => qc.invalidateQueries({ queryKey: ['super-admin', 'iam'] });

  const [deptForm, setDeptForm] = useState<{ id?: string; name: string; code: string; description: string } | null>(null);
  const [teamForm, setTeamForm] = useState<TeamForm | null>(null);

  const saveDept = useMutation({
    mutationFn: () =>
      deptForm!.id
        ? iamApi.updateDepartment(deptForm!.id, { name: deptForm!.name, description: deptForm!.description || null })
        : iamApi.createDepartment({ name: deptForm!.name, code: deptForm!.code, description: deptForm!.description || undefined }),
    onSuccess: () => {
      setDeptForm(null);
      refresh();
    },
  });
  const deleteDept = useMutation({ mutationFn: (id: string) => iamApi.deleteDepartment(id), onSuccess: refresh });

  const saveTeam = useMutation({
    mutationFn: () => {
      const f = teamForm!;
      const body = {
        departmentId: f.departmentId,
        name: f.name,
        parentId: f.parentId || null,
        description: f.description || undefined,
        ipAllowlist: splitList(f.ipAllowlist),
      };
      return f.id ? iamApi.updateTeam(f.id, body) : iamApi.createTeam({ ...body, code: f.code });
    },
    onSuccess: () => {
      setTeamForm(null);
      refresh();
    },
  });
  const deleteTeam = useMutation({ mutationFn: (id: string) => iamApi.deleteTeam(id), onSuccess: refresh });

  const teamsByDept = new Map<string, Team[]>();
  for (const t of teams.data ?? []) teamsByDept.set(t.departmentId, [...(teamsByDept.get(t.departmentId) ?? []), t]);
  const teamName = new Map((teams.data ?? []).map((t) => [t.id, t.name]));

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title="Departments & teams"
        description="How Rkyves staff are organised. Teams own tickets, on-call rotations and approvals; a team IP allowlist restricts where its members can sign in from."
        actions={
          canManage ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setDeptForm({ name: '', code: '', description: '' })}>
                New department
              </Button>
              <Button size="sm" onClick={() => setTeamForm({ ...emptyTeam, departmentId: departments.data?.[0]?.id ?? '' })}>
                New team
              </Button>
            </>
          ) : null
        }
      />
      <MutationError error={deleteDept.error ?? deleteTeam.error} />

      {(departments.data ?? []).map((d: Department) => (
        <SectionCard
          key={d.id}
          title={`${d.name} · ${d.code}`}
          actions={
            canManage ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setDeptForm({ id: d.id, name: d.name, code: d.code, description: d.description ?? '' })}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void confirm({ title: `Delete department ${d.name}?` }).then((ok) => ok && deleteDept.mutate(d.id))}
                >
                  Delete
                </Button>
              </>
            ) : null
          }
        >
          {d.description ? <p className="mb-3 text-sm text-text-secondary">{d.description}</p> : null}
          <p className="mb-3 text-xs text-text-muted">
            {d._count.employees} people · {d._count.teams} teams
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(teamsByDept.get(d.id) ?? []).map((t) => (
              <div key={t.id} className="rounded-lg border border-line-subtle p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-text-muted">
                      {t.code}
                      {t.parentId ? ` · under ${teamName.get(t.parentId) ?? '—'}` : ''}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        className="text-accent hover:underline"
                        onClick={() =>
                          setTeamForm({
                            id: t.id,
                            departmentId: t.departmentId,
                            name: t.name,
                            code: t.code,
                            parentId: t.parentId ?? '',
                            description: t.description ?? '',
                            ipAllowlist: t.ipAllowlist.join('\n'),
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-status-error hover:underline"
                        onClick={() => void confirm({ title: `Delete team ${t.name}?` }).then((ok) => ok && deleteTeam.mutate(t.id))}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  {t._count.employees} members
                  {t.ipAllowlist.length ? ` · IP restricted (${t.ipAllowlist.length})` : ''}
                </p>
              </div>
            ))}
            {(teamsByDept.get(d.id) ?? []).length === 0 ? <p className="text-sm text-text-muted">No teams yet.</p> : null}
          </div>
        </SectionCard>
      ))}
      {departments.data?.length === 0 ? <p className="text-sm text-text-muted">No departments yet.</p> : null}

      <Dialog
        open={Boolean(deptForm)}
        onClose={() => setDeptForm(null)}
        title={deptForm?.id ? 'Edit department' : 'New department'}
        footer={
          <Button size="sm" loading={saveDept.isPending} onClick={() => saveDept.mutate()}>
            Save
          </Button>
        }
      >
        {deptForm ? (
          <div className="space-y-3">
            <LabeledInput label="Name">
              <input className={inputClass} value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
            </LabeledInput>
            {!deptForm.id ? (
              <LabeledInput label="Code" hint="Short unique code, e.g. SUP or FIN. Used in bulk imports.">
                <input
                  className={inputClass}
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                />
              </LabeledInput>
            ) : null}
            <LabeledInput label="Description">
              <textarea className={inputClass} value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} />
            </LabeledInput>
            <MutationError error={saveDept.error} />
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(teamForm)}
        onClose={() => setTeamForm(null)}
        title={teamForm?.id ? 'Edit team' : 'New team'}
        footer={
          <Button size="sm" loading={saveTeam.isPending} onClick={() => saveTeam.mutate()}>
            Save
          </Button>
        }
      >
        {teamForm ? (
          <div className="space-y-3">
            <LabeledInput label="Department">
              <select
                className={inputClass}
                value={teamForm.departmentId}
                onChange={(e) => setTeamForm({ ...teamForm, departmentId: e.target.value })}
              >
                {(departments.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </LabeledInput>
            <LabeledInput label="Name">
              <input className={inputClass} value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
            </LabeledInput>
            {!teamForm.id ? (
              <LabeledInput label="Code">
                <input
                  className={inputClass}
                  value={teamForm.code}
                  onChange={(e) => setTeamForm({ ...teamForm, code: e.target.value.toUpperCase() })}
                />
              </LabeledInput>
            ) : null}
            <LabeledInput label="Parent team (optional)">
              <select className={inputClass} value={teamForm.parentId} onChange={(e) => setTeamForm({ ...teamForm, parentId: e.target.value })}>
                <option value="">None</option>
                {(teams.data ?? [])
                  .filter((t) => t.id !== teamForm.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </LabeledInput>
            <LabeledInput label="Description">
              <textarea className={inputClass} value={teamForm.description} onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="IP allowlist (optional)" hint="One IP or IPv4 CIDR per line. Members can only use the portal from these networks.">
              <textarea
                className={`${inputClass} font-mono`}
                value={teamForm.ipAllowlist}
                onChange={(e) => setTeamForm({ ...teamForm, ipAllowlist: e.target.value })}
              />
            </LabeledInput>
            <MutationError error={saveTeam.error} />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
