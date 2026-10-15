import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, KeyRound, LifeBuoy, ShieldCheck } from 'lucide-react';
import { Button, Dialog } from '@cullinos/ui';
import { EntityAvatar, KpiCard, KpiGrid, PageHeader, SectionCard, StatusPill } from '@/components/ui';
import { inputClass, LabeledInput, MutationError, Notice } from '@/components/common';
import { StaffPicker } from '@/components/StaffPicker';
import { useCan } from '@/lib/permissions';
import { formatDateTime, iamApi, peopleApi, securityApi, type EmployeeProfile } from '@/lib/platform-api';
import { useAuthStore } from '@/stores/auth';

type EditForm = {
  title: string;
  departmentId: string;
  teamId: string;
  manager: { userId: string; label: string } | null;
  region: string;
  location: string;
  employmentStatus: 'active' | 'on_leave' | 'notice';
};

function toForm(p: EmployeeProfile): EditForm {
  return {
    title: p.title ?? '',
    departmentId: p.department?.id ?? '',
    teamId: p.team?.id ?? '',
    manager: p.manager ? { userId: p.manager.userId, label: `${p.manager.name} (${p.manager.employeeCode})` } : null,
    region: p.region ?? '',
    location: p.location ?? '',
    employmentStatus: p.employmentStatus === 'exited' ? 'active' : p.employmentStatus,
  };
}

export function EmployeeProfilePage() {
  const { userId = '' } = useParams();
  const qc = useQueryClient();
  const can = useCan();
  const me = useAuthStore((s) => s.admin);
  const key = ['super-admin', 'employee', userId];
  const query = useQuery({ queryKey: key, queryFn: () => peopleApi.profile(userId), enabled: Boolean(userId) });
  const departments = useQuery({ queryKey: ['super-admin', 'iam', 'departments'], queryFn: iamApi.departments });
  const teams = useQuery({ queryKey: ['super-admin', 'iam', 'teams'], queryFn: iamApi.teams });
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [offboardOpen, setOffboardOpen] = useState(false);
  const [offboardReason, setOffboardReason] = useState('');
  const [transferTo, setTransferTo] = useState<{ userId: string; label: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const save = useMutation({
    mutationFn: () => {
      const f = edit!;
      return peopleApi.update(userId, {
        title: f.title.trim() || null,
        departmentId: f.departmentId || null,
        teamId: f.teamId || null,
        managerUserId: f.manager?.userId ?? null,
        region: f.region.trim() || null,
        location: f.location.trim() || null,
        employmentStatus: f.employmentStatus,
      });
    },
    onSuccess: () => {
      setEdit(null);
      refresh();
    },
  });
  const offboard = useMutation({
    mutationFn: () => peopleApi.offboard(userId, { reason: offboardReason.trim() || undefined, transferToUserId: transferTo?.userId ?? null }),
    onSuccess: refresh,
  });
  const revokeSession = useMutation({ mutationFn: (id: string) => securityApi.revokeSession(id), onSuccess: refresh });
  const revokeAll = useMutation({ mutationFn: () => securityApi.revokeAllForUser(userId), onSuccess: refresh });

  const p = query.data;
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!p) return <Notice tone="error">{(query.error as Error)?.message ?? 'Employee not found'}</Notice>;
  const exited = p.employmentStatus === 'exited';
  const self = p.userId === me?.id;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'People & Access' }, { label: 'Directory', to: '/people' }, { label: p.name }]}
        leading={<EntityAvatar name={p.name} size={48} rounded="full" />}
        title={p.name}
        description={`${p.employeeCode} · ${p.title ?? 'No title'} · ${p.email}`}
        meta={<StatusPill status={p.employmentStatus} />}
        actions={
          <>
            {can('directory.manage') && !exited ? (
              <Button size="sm" variant="secondary" onClick={() => setEdit(toForm(p))}>
                Edit
              </Button>
            ) : null}
            {can('team.manage') && !exited && !self ? (
              <Button size="sm" variant="danger" onClick={() => setOffboardOpen(true)}>
                Offboard
              </Button>
            ) : null}
          </>
        }
      />
      {save.data?.reviewCampaignId ? (
        <Notice tone="info">
          Team changed — an access review was opened for the new manager.{' '}
          <Link className="underline" to={`/access/reviews/${save.data.reviewCampaignId}`}>
            Open review
          </Link>
        </Notice>
      ) : null}

      <KpiGrid>
        <KpiCard label="Open tickets" value={p.openTickets} icon={LifeBuoy} tone="orange" />
        <KpiCard label="Active tenant access" value={p.activeGrants} icon={KeyRound} tone="violet" />
        <KpiCard label="Extra roles" value={p.assignments.filter((a) => !a.expired).length} icon={ShieldCheck} tone="indigo" />
        <KpiCard label="Last login" value={<span className="text-base">{formatDateTime(p.lastLoginAt)}</span>} icon={Clock} tone="blue" />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Organisation">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-text-muted">Department</dt>
              <dd>{p.department?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Team</dt>
              <dd>{p.team?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Manager</dt>
              <dd>{p.manager ? <Link className="text-accent hover:underline" to={`/people/${p.manager.userId}`}>{p.manager.name}</Link> : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Primary role</dt>
              <dd>{p.primaryRole ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Region / location</dt>
              <dd>{[p.region, p.location].filter(Boolean).join(' · ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Joined / exited</dt>
              <dd>
                {formatDateTime(p.joinedAt)} {p.exitedAt ? `→ ${formatDateTime(p.exitedAt)}` : ''}
              </dd>
            </div>
          </dl>
          {p.reports.length ? (
            <div className="mt-4">
              <p className="text-xs text-text-muted">Direct reports</p>
              <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                {p.reports.map((r) => (
                  <li key={r.userId}>
                    <Link className="rounded-full border border-line px-3 py-1 hover:bg-hover" to={`/people/${r.userId}`}>
                      {r.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Extra roles">
          <ul className="space-y-2 text-sm">
            {p.assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span>
                  {a.role.name}{' '}
                  <span className="text-xs text-text-muted">
                    {a.scopeType === 'global' ? 'all tenants' : `${a.scopeType}: ${a.scopeValues.join(', ')}`}
                    {a.expiresAt ? ` · until ${formatDateTime(a.expiresAt)}` : ''}
                  </span>
                </span>
                {a.expired ? <StatusPill status="expired" /> : null}
              </li>
            ))}
            {p.assignments.length === 0 ? <li className="text-text-muted">Only the primary role.</li> : null}
          </ul>
          {me?.platformRole === 'owner' ? (
            <Link to="/iam/assignments" className="mt-3 inline-block text-sm text-accent hover:underline">
              Manage assignments
            </Link>
          ) : null}
        </SectionCard>

        {p.sessions ? (
          <SectionCard
            title={`Active sessions (${p.sessions.length})`}
            actions={
              p.sessions.length ? (
                <Button size="sm" variant="ghost" loading={revokeAll.isPending} onClick={() => revokeAll.mutate()}>
                  Sign out everywhere
                </Button>
              ) : null
            }
          >
            <ul className="space-y-2 text-sm">
              {p.sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate">{s.userAgent ?? 'Unknown device'}</span>
                    <span className="text-xs text-text-muted">
                      {s.portal ?? '—'} · since {formatDateTime(s.createdAt)}
                    </span>
                  </span>
                  <button type="button" className="text-xs text-status-error hover:underline" onClick={() => revokeSession.mutate(s.id)}>
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
            <MutationError error={revokeSession.error ?? revokeAll.error} />
          </SectionCard>
        ) : null}

        {p.recentActivity ? (
          <SectionCard
            title="Recent activity"
            actions={
              <Link to={`/activity?employeeCode=${p.employeeCode}`} className="text-sm text-accent hover:underline">
                Full log
              </Link>
            }
          >
            <ul className="space-y-1 text-xs">
              {p.recentActivity.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span className="truncate font-mono">{a.action}</span>
                  <span className="shrink-0 text-text-muted">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}

        <SectionCard title="Upcoming shifts">
          <ul className="space-y-1 text-sm">
            {p.upcomingShifts.map((s) => (
              <li key={s.id}>
                <StatusPill status={s.kind} /> {formatDateTime(s.startsAt)} → {formatDateTime(s.endsAt)}
              </li>
            ))}
            {p.upcomingShifts.length === 0 ? <li className="text-text-muted">None scheduled.</li> : null}
          </ul>
        </SectionCard>
      </div>

      <Dialog
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title="Edit employee"
        description="Moving someone to a new team opens an access review for their new manager."
        footer={
          <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        }
      >
        {edit ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledInput label="Title">
              <input className={inputClass} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Status">
              <select
                className={inputClass}
                value={edit.employmentStatus}
                onChange={(e) => setEdit({ ...edit, employmentStatus: e.target.value as EditForm['employmentStatus'] })}
              >
                <option value="active">Active</option>
                <option value="on_leave">On leave</option>
                <option value="notice">Serving notice</option>
              </select>
            </LabeledInput>
            <LabeledInput label="Department">
              <select className={inputClass} value={edit.departmentId} onChange={(e) => setEdit({ ...edit, departmentId: e.target.value })}>
                <option value="">None</option>
                {(departments.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </LabeledInput>
            <LabeledInput label="Team">
              <select className={inputClass} value={edit.teamId} onChange={(e) => setEdit({ ...edit, teamId: e.target.value })}>
                <option value="">None</option>
                {(teams.data ?? [])
                  .filter((t) => !edit.departmentId || t.departmentId === edit.departmentId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </LabeledInput>
            <div className="sm:col-span-2">
              <LabeledInput label="Manager">
                <StaffPicker value={edit.manager} onChange={(manager) => setEdit({ ...edit, manager })} />
              </LabeledInput>
            </div>
            <LabeledInput label="Region">
              <input className={inputClass} value={edit.region} onChange={(e) => setEdit({ ...edit, region: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Location">
              <input className={inputClass} value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} />
            </LabeledInput>
            <div className="sm:col-span-2">
              <MutationError error={save.error} />
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={offboardOpen}
        onClose={() => {
          offboard.reset();
          setOffboardOpen(false);
        }}
        title={`Offboard ${p.name}`}
        description="Signs them out, removes all roles and tenant access, hands over their tickets, withdraws their pending approvals and removes them from on-call."
        footer={
          offboard.data ? null : (
            <Button size="sm" variant="danger" loading={offboard.isPending} onClick={() => offboard.mutate()}>
              Offboard now
            </Button>
          )
        }
      >
        {offboard.data ? (
          <Notice tone="success">
            {offboard.data.employeeCode} offboarded: {offboard.data.revokedAssignments} roles and {offboard.data.revokedGrants} tenant grants revoked,{' '}
            {offboard.data.transferredTickets} tickets handed over, {offboard.data.cancelledApprovals} approvals withdrawn, {offboard.data.rotationsUpdated}{' '}
            rotations updated.
          </Notice>
        ) : (
          <div className="space-y-3">
            <LabeledInput label="Hand over open tickets to">
              <StaffPicker value={transferTo} onChange={setTransferTo} placeholder="Leave empty to unassign" />
            </LabeledInput>
            <LabeledInput label="Reason">
              <input className={inputClass} value={offboardReason} onChange={(e) => setOffboardReason(e.target.value)} />
            </LabeledInput>
            <MutationError error={offboard.error} />
          </div>
        )}
      </Dialog>
    </div>
  );
}
