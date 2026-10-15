import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Dialog } from '@cullinos/ui';
import { EmptyRow, Label, Notice, Panel, inputClass } from '@/components/common';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { agentApi, type Rotation } from '@/lib/support-api';
import { useCanAgent } from '@/stores/session';

type Person = { userId: string; label: string };
type ShiftForm = { user: Person | null; teamId: string; kind: string; startsAt: string; endsAt: string; note: string };
type RotationForm = { id?: string; teamId: string; name: string; members: Person[]; rotationDays: number; startsAt: string };

function PersonPicker({ placeholder, onPick }: { placeholder: string; onPick: (p: Person) => void }) {
  const [q, setQ] = useState('');
  const results = useQuery({ queryKey: ['agent', 'staff', q], queryFn: () => agentApi.staff(q), enabled: q.trim().length >= 2 });
  return (
    <div className="relative">
      <input className={inputClass} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim().length >= 2 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-bg-card shadow-lg">
          {(results.data?.data ?? []).map((s) => (
            <li key={s.userId}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-hover"
                onClick={() => {
                  onPick({ userId: s.userId, label: `${s.name} (${s.employeeCode})` });
                  setQ('');
                }}
              >
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-xs text-text-muted">
                  {s.employeeCode} · {s.email}
                </span>
              </button>
            </li>
          ))}
          {results.data && results.data.data.length === 0 ? <li className="px-3 py-2 text-sm text-text-muted">No matches</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

const KIND_LABELS: Record<string, string> = { shift: 'Shift', on_call: 'On call', leave: 'Leave' };

export function AgentShiftsPage() {
  const qc = useQueryClient();
  const can = useCanAgent();
  const canManage = can('shifts.manage');
  const [teamId, setTeamId] = useState('');
  const teams = useQuery({ queryKey: ['agent', 'teams'], queryFn: agentApi.teams });
  const shifts = useQuery({
    queryKey: ['agent', 'shifts', teamId],
    queryFn: () => agentApi.shifts({ teamId: teamId || undefined }),
    enabled: can('directory.read'),
  });
  const rotations = useQuery({ queryKey: ['agent', 'rotations'], queryFn: agentApi.rotations });
  const [shiftForm, setShiftForm] = useState<ShiftForm | null>(null);
  const [rotForm, setRotForm] = useState<RotationForm | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['agent', 'shifts'] });
    qc.invalidateQueries({ queryKey: ['agent', 'rotations'] });
  };

  const createShift = useMutation({
    mutationFn: () => {
      const f = shiftForm!;
      return agentApi.createShift({
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
  const deleteShift = useMutation({ mutationFn: (id: string) => agentApi.deleteShift(id), onSuccess: refresh });
  const saveRotation = useMutation({
    mutationFn: () => {
      const f = rotForm!;
      const body = {
        name: f.name.trim(),
        memberUserIds: f.members.map((m) => m.userId),
        rotationDays: f.rotationDays,
        startsAt: new Date(f.startsAt).toISOString(),
      };
      return f.id ? agentApi.updateRotation(f.id, body) : agentApi.createRotation({ ...body, teamId: f.teamId });
    },
    onSuccess: () => {
      setRotForm(null);
      refresh();
    },
  });
  const toggleRotation = useMutation({
    mutationFn: (r: Rotation) => agentApi.updateRotation(r.id, { isActive: !r.isActive }),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Shifts & on-call</h1>
          <p className="text-sm text-text-secondary">Who is working and who is on call. New tickets for a team go to its current on-call engineer automatically.</p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
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
          </div>
        ) : null}
      </div>

      <Panel title="On-call rotations">
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
                <span className="rounded-md bg-hover px-2 py-0.5 text-xs font-medium">{r.isActive ? 'active' : 'paused'}</span>
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
        {rotations.error ? <Notice tone="error">{errorMessage(rotations.error)}</Notice> : null}
      </Panel>

      <Panel
        title="Upcoming shifts"
        actions={
          <select className={`${inputClass} h-8 w-44`} value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Team">
            <option value="">All teams</option>
            {(teams.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        }
        flush
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-line-subtle bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Employee</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">From</th>
                <th className="px-4 py-2.5 font-semibold">To</th>
                <th className="px-4 py-2.5 font-semibold">Note</th>
                <th className="px-4 py-2.5 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {(shifts.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    {s.user?.name ?? s.userId}
                    {s.user?.employeeCode ? <span className="ml-1 text-xs text-text-muted">({s.user.employeeCode})</span> : null}
                  </td>
                  <td className="px-4 py-3">{KIND_LABELS[s.kind] ?? s.kind}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDateTime(s.startsAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDateTime(s.endsAt)}</td>
                  <td className="px-4 py-3 text-xs">{s.note ?? ''}</td>
                  <td className="px-4 py-3 text-right">
                    {canManage ? (
                      <button type="button" className="text-xs text-status-error hover:underline" onClick={() => deleteShift.mutate(s.id)}>
                        Remove
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!shifts.isLoading && (shifts.data ?? []).length === 0 ? <EmptyRow>No shifts in the next two weeks.</EmptyRow> : null}
      </Panel>

      <Dialog
        open={Boolean(shiftForm)}
        onClose={() => setShiftForm(null)}
        title="Add shift"
        footer={
          <Button size="sm" loading={createShift.isPending} disabled={!shiftForm?.user || !shiftForm?.startsAt || !shiftForm?.endsAt} onClick={() => createShift.mutate()}>
            Save
          </Button>
        }
      >
        {shiftForm ? (
          <div className="space-y-3">
            <Label label="Employee">
              {shiftForm.user ? (
                <div className="flex items-center justify-between text-sm">
                  <span>{shiftForm.user.label}</span>
                  <button type="button" className="text-xs text-text-muted hover:underline" onClick={() => setShiftForm({ ...shiftForm, user: null })}>
                    Change
                  </button>
                </div>
              ) : (
                <PersonPicker placeholder="Search staff by name or email…" onPick={(user) => setShiftForm({ ...shiftForm, user })} />
              )}
            </Label>
            <Label label="Type">
              <select className={inputClass} value={shiftForm.kind} onChange={(e) => setShiftForm({ ...shiftForm, kind: e.target.value })}>
                <option value="shift">Shift</option>
                <option value="on_call">On call</option>
                <option value="leave">Leave</option>
              </select>
            </Label>
            <Label label="Team">
              <select className={inputClass} value={shiftForm.teamId} onChange={(e) => setShiftForm({ ...shiftForm, teamId: e.target.value })}>
                <option value="">None</option>
                {(teams.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Label label="Starts">
                <input type="datetime-local" className={inputClass} value={shiftForm.startsAt} onChange={(e) => setShiftForm({ ...shiftForm, startsAt: e.target.value })} />
              </Label>
              <Label label="Ends">
                <input type="datetime-local" className={inputClass} value={shiftForm.endsAt} onChange={(e) => setShiftForm({ ...shiftForm, endsAt: e.target.value })} />
              </Label>
            </div>
            <Label label="Note">
              <input className={inputClass} value={shiftForm.note} onChange={(e) => setShiftForm({ ...shiftForm, note: e.target.value })} />
            </Label>
            {createShift.error ? <Notice tone="error">{errorMessage(createShift.error)}</Notice> : null}
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
              <Label label="Team">
                <select className={inputClass} value={rotForm.teamId} onChange={(e) => setRotForm({ ...rotForm, teamId: e.target.value })}>
                  {(teams.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Label>
            ) : null}
            <Label label="Name">
              <input className={inputClass} value={rotForm.name} onChange={(e) => setRotForm({ ...rotForm, name: e.target.value })} />
            </Label>
            <div className="space-y-1.5 text-sm">
              <span className="font-medium text-text-secondary">Members (in rotation order)</span>
              <ol className="space-y-1">
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
              <PersonPicker
                placeholder="Add a member…"
                onPick={(v) => !rotForm.members.some((m) => m.userId === v.userId) && setRotForm({ ...rotForm, members: [...rotForm.members, v] })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Label label="Days per turn">
                <input
                  type="number"
                  min={1}
                  max={31}
                  className={inputClass}
                  value={rotForm.rotationDays}
                  onChange={(e) => setRotForm({ ...rotForm, rotationDays: Number(e.target.value) })}
                />
              </Label>
              <Label label="Starts">
                <input type="datetime-local" className={inputClass} value={rotForm.startsAt} onChange={(e) => setRotForm({ ...rotForm, startsAt: e.target.value })} />
              </Label>
            </div>
            {saveRotation.error ? <Notice tone="error">{errorMessage(saveRotation.error)}</Notice> : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
