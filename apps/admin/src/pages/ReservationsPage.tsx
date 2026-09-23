import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, PhoneField } from '@cullinos/ui';
import { outletsApi, reservationsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

function todayYmd() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function ReservationsPage() {
  const queryClient = useQueryClient();
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const [outletId, setOutletId] = useState(selectedOutletId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
  });
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    partySize: '2',
    date: todayYmd(),
    slotStart: '',
    notes: '',
  });
  const [settingsForm, setSettingsForm] = useState({
    reservationSlotMinutes: '90',
    reservationMaxCoversPerSlot: '20',
  });

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });

  useEffect(() => {
    if (!outletId && selectedOutletId) setOutletId(selectedOutletId);
  }, [selectedOutletId, outletId]);

  const reservationsQuery = useQuery({
    queryKey: ['reservations', outletId],
    queryFn: () => reservationsApi.list({ outletId: outletId || undefined }),
    enabled: !!outletId,
  });

  const settingsQuery = useQuery({
    queryKey: ['reservation-settings', outletId],
    queryFn: () => reservationsApi.getSettings(outletId),
    enabled: !!outletId,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettingsForm({
        reservationSlotMinutes: String(settingsQuery.data.reservationSlotMinutes),
        reservationMaxCoversPerSlot: String(settingsQuery.data.reservationMaxCoversPerSlot),
      });
    }
  }, [settingsQuery.data]);

  const slotsQuery = useQuery({
    queryKey: ['reservation-slots', outletId, form.date, form.partySize],
    queryFn: () =>
      reservationsApi.slots({
        outletId,
        date: form.date,
        partySize: Number(form.partySize) || 1,
      }),
    enabled: !!outletId && !!form.date,
  });

  const availableSlots = useMemo(
    () => (slotsQuery.data?.slots ?? []).filter((s) => s.available),
    [slotsQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: reservationsApi.create,
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['reservation-slots'] });
      setForm({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        partySize: '2',
        date: todayYmd(),
        slotStart: '',
        notes: '',
      });
      setError(null);
      const parts = [
        'Reservation created.',
        row.emailSent ? 'Confirmation email sent.' : null,
        row.smsSent ? 'Confirmation SMS sent.' : null,
      ].filter(Boolean);
      setSuccess(parts.join(' '));
    },
    onError: (err: Error) => setError(err.message),
  });

  const inviteMutation = useMutation({
    mutationFn: reservationsApi.createInvite,
    onSuccess: (result) => {
      setShowInvite(false);
      setInviteForm({ customerName: '', customerPhone: '', customerEmail: '' });
      setError(null);
      const parts = [
        'Invitation created.',
        result.emailSent ? 'Email sent.' : null,
        result.smsSent ? 'SMS sent.' : null,
        !result.emailSent && !result.smsSent
          ? `Share link: ${result.bookUrl}`
          : null,
      ].filter(Boolean);
      setSuccess(parts.join(' '));
    },
    onError: (err: Error) => setError(err.message),
  });

  const settingsMutation = useMutation({
    mutationFn: reservationsApi.updateSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reservation-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['reservation-slots'] });
      setSuccess('Reservation settings saved.');
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      reservationsApi.update(id, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['reservations'] }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);
    if (!outletId) {
      setError('Select an outlet');
      return;
    }
    if (!form.slotStart) {
      setError('Select an available slot');
      return;
    }
    createMutation.mutate({
      outletId,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail || undefined,
      partySize: Number(form.partySize),
      reservedAt: form.slotStart,
      notes: form.notes || undefined,
      status: 'confirmed',
    });
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);
    if (!outletId) {
      setError('Select an outlet');
      return;
    }
    inviteMutation.mutate({
      outletId,
      customerName: inviteForm.customerName,
      customerPhone: inviteForm.customerPhone,
      customerEmail: inviteForm.customerEmail || undefined,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Reservations</h1>
        <p className="mt-1 text-text-secondary">
          Send invitation links or create manual bookings with live slot availability.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {success}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-4 rounded-xl border border-white/5 bg-bg-card p-4">
        <label className="space-y-1 text-sm">
          <span className="text-text-secondary">Outlet</span>
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="block h-11 min-w-[200px] rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
          >
            <option value="">Select outlet</option>
            {(outletsQuery.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" disabled={!outletId} onClick={() => setShowInvite(true)}>
            Send invitation
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!outletId}
            onClick={() => {
              document.getElementById('manual-reservation')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Manual reservation
          </Button>
        </div>
      </div>

      {outletId ? (
        <form
          className="grid gap-4 rounded-xl border border-white/5 bg-bg-card p-6 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            settingsMutation.mutate({
              outletId,
              reservationSlotMinutes: Number(settingsForm.reservationSlotMinutes),
              reservationMaxCoversPerSlot: Number(settingsForm.reservationMaxCoversPerSlot),
            });
          }}
        >
          <h2 className="font-medium md:col-span-3">Slot settings</h2>
          <Input
            label="Slot length (minutes)"
            type="number"
            min={15}
            max={240}
            value={settingsForm.reservationSlotMinutes}
            onChange={(e) =>
              setSettingsForm((f) => ({ ...f, reservationSlotMinutes: e.target.value }))
            }
          />
          <Input
            label="Max covers per slot"
            type="number"
            min={1}
            max={500}
            value={settingsForm.reservationMaxCoversPerSlot}
            onChange={(e) =>
              setSettingsForm((f) => ({ ...f, reservationMaxCoversPerSlot: e.target.value }))
            }
          />
          <div className="flex items-end">
            <Button type="submit" loading={settingsMutation.isPending}>
              Save settings
            </Button>
          </div>
        </form>
      ) : null}

      {showInvite ? (
        <form
          onSubmit={handleInvite}
          className="grid gap-4 rounded-xl border border-brand-primary/30 bg-bg-card p-6 md:grid-cols-2"
        >
          <h2 className="font-medium md:col-span-2">Send invitation link</h2>
          <p className="text-sm text-text-secondary md:col-span-2">
            Guest receives a link to pick an available slot. Sent to email and/or SMS when configured.
          </p>
          <Input
            label="Guest name"
            required
            value={inviteForm.customerName}
            onChange={(e) => setInviteForm((f) => ({ ...f, customerName: e.target.value }))}
          />
          <PhoneField
            className="md:col-span-2"
            label="Phone"
            required
            value={inviteForm.customerPhone}
            onChange={(customerPhone) => setInviteForm((f) => ({ ...f, customerPhone }))}
          />
          <Input
            className="md:col-span-2"
            label="Email (optional)"
            type="email"
            value={inviteForm.customerEmail}
            onChange={(e) => setInviteForm((f) => ({ ...f, customerEmail: e.target.value }))}
          />
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" loading={inviteMutation.isPending} disabled={!outletId}>
              Send invitation
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <form
        id="manual-reservation"
        onSubmit={handleCreate}
        className="grid gap-4 rounded-xl border border-white/5 bg-bg-card p-6 md:grid-cols-2"
      >
        <h2 className="font-medium md:col-span-2">Manual reservation</h2>
        <Input
          label="Guest name"
          required
          value={form.customerName}
          onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
        />
        <Input
          label="Email (optional)"
          type="email"
          value={form.customerEmail}
          onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
        />
        <PhoneField
          className="md:col-span-2"
          label="Phone"
          required
          value={form.customerPhone}
          onChange={(customerPhone) => setForm((f) => ({ ...f, customerPhone }))}
        />
        <Input
          label="Party size"
          type="number"
          min={1}
          required
          value={form.partySize}
          onChange={(e) => setForm((f) => ({ ...f, partySize: e.target.value, slotStart: '' }))}
        />
        <label className="block text-sm">
          <span className="mb-1.5 block text-text-secondary">Date</span>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, slotStart: '' }))}
            className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="mb-1.5 block text-text-secondary">Available slot</span>
          <select
            required
            value={form.slotStart}
            onChange={(e) => setForm((f) => ({ ...f, slotStart: e.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
          >
            <option value="">
              {slotsQuery.isLoading ? 'Loading slots…' : 'Select a slot'}
            </option>
            {availableSlots.map((s) => (
              <option key={s.startAt} value={s.startAt}>
                {new Date(s.startAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {s.coversAvailable} covers left
              </option>
            ))}
          </select>
          {!slotsQuery.isLoading && availableSlots.length === 0 ? (
            <span className="mt-1 block text-xs text-text-muted">
              No open slots for this date / party size. Check opening hours and capacity settings.
            </span>
          ) : null}
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="mb-1.5 block text-text-secondary">Notes</span>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
          />
        </label>
        <div className="md:col-span-2">
          <Button type="submit" loading={createMutation.isPending} disabled={!outletId}>
            Create reservation
          </Button>
        </div>
      </form>

      <section className="rounded-xl border border-white/5 bg-bg-card p-6">
        <h2 className="mb-4 font-medium">Upcoming reservations</h2>
        {reservationsQuery.isLoading ? (
          <p className="text-text-muted">Loading…</p>
        ) : (reservationsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">No reservations yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {(reservationsQuery.data ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {r.customerName} · {r.partySize} guests
                  </p>
                  <p className="text-text-secondary">
                    {new Date(r.reservedAt).toLocaleString()} · {r.customerPhone}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs uppercase">
                    {r.status}
                  </span>
                  {r.status === 'pending' ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: r.id, status: 'confirmed' })}
                    >
                      Confirm
                    </Button>
                  ) : null}
                  {['pending', 'confirmed'].includes(r.status) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => updateMutation.mutate({ id: r.id, status: 'cancelled' })}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
