import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Dialog } from '@cullinos/ui';
import { DataTable, PageHeader, SectionCard, StatusPill } from '@/components/ui';
import { inputClass, LabeledInput, MutationError } from '@/components/common';
import { StaffPicker } from '@/components/StaffPicker';
import { useCan } from '@/lib/permissions';
import { formatDateTime, iamApi, peopleApi, type Rotation } from '@/lib/platform-api';

type ShiftForm = { user: { userId: string; label: string } | null; teamId: string; kind: string; startsAt: string; endsAt: string; note: string };
type RotationForm = { id?: string; teamId: string; name: string; members: { userId: string; label: string }[]; rotationDays: number; startsAt: string };

export function ShiftsPage() {
  const qc = useQueryClient();
  const can = useCan();
  const canManage = can('shifts.manage');
  const [teamId, setTeamId] = useState('');
  const teams = useQuery({ queryKey: ['super-admin', 'iam', 'teams'], queryFn: iamApi.teams });
  const shifts = useQuery({
    queryKey: ['super-admin', 'shifts', teamId],
    queryFn: () => peopleApi.shifts({ teamId: teamId || undefined }),
    enabled: can('directory.read'),
  });
  const rotations = useQuery({ queryKey: ['super-admin', 'rotations'], queryFn: peopleApi.rotations });
  const [shiftForm, setShiftForm] = useState<ShiftForm | null>(null);
  const [rotForm, setRotForm] = useState<RotationForm | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['super-admin', 'shifts'] });
    qc.invalidateQueries({ queryKey: ['super-admin', 'rotations'] });
  };

  const createShift = useMutation({
    mutationFn: () => {
      const f = shiftForm!;
      return peopleApi.createShift({
        userId: f.user!.userId,
        teamId: f.teamId || null,
        kind: f.kind,
        startsAt: new Date(f.startsAt).toISOString(),
        endsAt: new Date(f.endsAt).toISOString(),
        note: f.note.trim() || undefined,
      });
    },
    onSuccess: () => {
      setShiftForm(null);
      refresh();
    },
  });
  const deleteShift = useMutation({ mutationFn: (id: string) => peopleApi.deleteShift(id), onSuccess: refresh });
  const saveRotation = useMutation({
    mutationFn: () => {
      const f = rotForm!;
      const body = {
        name: f.name.trim(),
        memberUserIds: f.members.map((m) => m.userId),
        rotationDays: f.rotationDays,
        startsAt: new Date(f.startsAt).toISOString(),
      };
      return f.id ? peopleApi.updateRotation(f.id, body) : peopleApi.createRotation({ ...body, teamId: f.teamId });
    },
    onSuccess: () => {
      setRotForm(null);
      refresh();
    },
  });
  const toggleRotation = useMutation({
    mutationFn: (r: Rotation) => peopleApi.updateRotation(r.id, { isActive: !r.isActive }),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts & on-call"
        description="Who is working and who is on call. New tickets for a team go to its current on-call engineer automatically."
        actions={
          canManage ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setRotForm({ teamId: teams.data?.[0]?.id ?? '', name: '', members: [], rotationDays: 7, startsAt: new Date().toISOString().slice(0, 16) })
                }
              >
                New rotation
              </Button>
              <Button size="sm" onClick={() => setShiftForm({ user: null, teamId: '', kind: 'shift', startsAt: '', endsAt: '', note: '' })}>
                Add shift
              </Button>
            </>
          ) : null
        }
      />

      <SectionCard title="On-call rotations">
        <div className="grid gap-4 md:grid-cols-2">
          {(rotations.data ?? []).map((r) => (
            <div key={r.id} className="rounded-lg border border-line-subtle p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-text-muted">
                    {r.team?.name ?? '—'} · {r.rotationDays}-day turns · {r.members.length} people
                  </p>
                </div>
                <Badge variant={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'active' : 'paused'}</Badge>
              </div>
              <p className="mt-3 text-sm">
                On call now: <span className="font-semibold">{r.onCall?.name ?? '—'}</span>
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-text-secondary">
                {r.schedule.slice(1, 4).map((s) => (
                  <li key={s.from}>
                    {formatDateTime(s.from)} → {s.user?.name ?? s.userId}
                  </li>
                ))}
              </ul>
              {canManage ? (
                <div className="mt-3 flex gap-3 text-xs">
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() =>
                      setRotForm({
                        id: r.id,
                        teamId: r.teamId,
                        name: r.name,
                        members: r.members.map((m) => ({ userId: m.id, label: m.name ?? m.id })),
                        rotationDays: r.rotationDays,
                        startsAt: r.startsAt.slice(0, 16),
                      })
                    }
                  >
                    Edit
                  </button>
                  <button type="button" className="text-text-secondary hover:underline" onClick={() => toggleRotation.mutate(r)}>
                    {r.isActive ? 'Pause' : 'Resume'}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {rotations.data?.length === 0 ? <p className="text-sm text-text-muted">No rotations yet.</p> : null}
        </div>
      </SectionCard>

      <DataTable
        rows={shifts.data ?? []}
        loading={shifts.isLoading}
        getRowKey={(s) => s.id}
        emptyMessage="No shifts in the next two weeks."
        toolbar={
          <select className={`${inputClass} w-auto`} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">All teams</option>
            {(teams.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        }
        columns={[
          { key: 'who', header: 'Employee', cell: (s) => `${s.user?.name ?? s.userId}${s.user?.employeeCode ? ` (${s.user.employeeCode})` : ''}` },
          { key: 'kind', header: 'Type', cell: (s) => <StatusPill status={s.kind} /> },
          { key: 'from', header: 'From', cell: (s) => formatDateTime(s.startsAt) },
          { key: 'to', header: 'To', cell: (s) => formatDateTime(s.endsAt) },
          { key: 'note', header: 'Note', cell: (s) => s.note ?? '' },
          {
            key: 'x',
            header: '',
            cell: (s) =>
              canManage ? (
                <button type="button" className="text-xs text-status-error hover:underline" onClick={() => deleteShift.mutate(s.id)}>
                  Remove
                </button>
              ) : null,
          },
        ]}
      />

      <Dialog
        open={Boolean(shiftForm)}
        onClose={() => setShiftForm(null)}
        title="Add shift"
        footer={
          <Button
            size="sm"
            loading={createShift.isPending}
            disabled={!shiftForm?.user || !shiftForm?.startsAt || !shiftForm?.endsAt}
            onClick={() => createShift.mutate()}
          >
            Save
          </Button>
        }
      >
        {shiftForm ? (
          <div className="space-y-3">
            <LabeledInput label="Employee">
              <StaffPicker value={shiftForm.user} onChange={(user) => setShiftForm({ ...shiftForm, user })} />
            </LabeledInput>
            <LabeledInput label="Type">
              <select className={inputClass} value={shiftForm.kind} onChange={(e) => setShiftForm({ ...shiftForm, kind: e.target.value })}>
                <option value="shift">Shift</option>
                <option value="on_call">On call</option>
                <option value="leave">Leave</option>
              </select>
            </LabeledInput>
            <LabeledInput label="Team">
              <select className={inputClass} value={shiftForm.teamId} onChange={(e) => setShiftForm({ ...shiftForm, teamId: e.target.value })}>
                <option value="">None</option>
                {(teams.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </LabeledInput>
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput label="Starts">
                <input type="datetime-local" className={inputClass} value={shiftForm.startsAt} onChange={(e) => setShiftForm({ ...shiftForm, startsAt: e.target.value })} />
              </LabeledInput>
              <LabeledInput label="Ends">
                <input type="datetime-local" className={inputClass} value={shiftForm.endsAt} onChange={(e) => setShiftForm({ ...shiftForm, endsAt: e.target.value })} />
              </LabeledInput>
            </div>
            <LabeledInput label="Note">
              <input className={inputClass} value={shiftForm.note} onChange={(e) => setShiftForm({ ...shiftForm, note: e.target.value })} />
            </LabeledInput>
            <MutationError error={createShift.error} />
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(rotForm)}
        onClose={() => setRotForm(null)}
        title={rotForm?.id ? 'Edit rotation' : 'New rotation'}
        footer={
          <Button size="sm" loading={saveRotation.isPending} disabled={!rotForm?.name.trim() || !rotForm?.members.length} onClick={() => saveRotation.mutate()}>
            Save
          </Button>
        }
      >
        {rotForm ? (
          <div className="space-y-3">
            {!rotForm.id ? (
              <LabeledInput label="Team">
                <select className={inputClass} value={rotForm.teamId} onChange={(e) => setRotForm({ ...rotForm, teamId: e.target.value })}>
                  {(teams.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </LabeledInput>
            ) : null}
            <LabeledInput label="Name">
              <input className={inputClass} value={rotForm.name} onChange={(e) => setRotForm({ ...rotForm, name: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Members (in rotation order)">
              <ol className="mb-2 space-y-1 text-sm">
                {rotForm.members.map((m, i) => (
                  <li key={m.userId} className="flex items-center justify-between">
                    <span>
                      {i + 1}. {m.label}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-status-error"
                      onClick={() => setRotForm({ ...rotForm, members: rotForm.members.filter((x) => x.userId !== m.userId) })}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
              <StaffPicker
                value={null}
                placeholder="Add a member…"
                onChange={(v) =>
                  v && !rotForm.members.some((m) => m.userId === v.userId) && setRotForm({ ...rotForm, members: [...rotForm.members, v] })
                }
              />
            </LabeledInput>
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput label="Days per turn">
                <input
                  type="number"
                  min={1}
                  max={31}
                  className={inputClass}
                  value={rotForm.rotationDays}
                  onChange={(e) => setRotForm({ ...rotForm, rotationDays: Number(e.target.value) })}
                />
              </LabeledInput>
              <LabeledInput label="Starts">
                <input type="datetime-local" className={inputClass} value={rotForm.startsAt} onChange={(e) => setRotForm({ ...rotForm, startsAt: e.target.value })} />
              </LabeledInput>
            </div>
            <MutationError error={saveRotation.error} />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
