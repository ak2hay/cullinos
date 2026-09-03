import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button, Input } from '@/components/ui/Form';
import { eventsApi, outletsApi } from '@/lib/api';

export function EventsPage() {
  const queryClient = useQueryClient();
  const [outletId, setOutletId] = useState('');
  const [form, setForm] = useState({
    name: '',
    location: '',
    eventDate: '',
    startTime: '11:00',
    endTime: '15:00',
  });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function showNotice(type: 'success' | 'error', text: string) {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 5000);
  }

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });

  // Auto-select the first outlet so the form is always ready to submit
  useEffect(() => {
    if (!outletId && outletsQuery.data && outletsQuery.data.length > 0) {
      setOutletId(outletsQuery.data[0].id);
    }
  }, [outletsQuery.data, outletId]);

  const eventsQuery = useQuery({
    queryKey: ['events', outletId],
    queryFn: () => eventsApi.list(outletId || undefined),
    enabled: Boolean(outletId || outletsQuery.data?.length),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const resolvedOutletId = outletId || outletsQuery.data?.[0]?.id;
      if (!resolvedOutletId) throw new Error('Please select an outlet first.');
      return eventsApi.create({
        outletId: resolvedOutletId,
        ...form,
        eventDate: new Date(form.eventDate).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setForm({ name: '', location: '', eventDate: '', startTime: '11:00', endTime: '15:00' });
      showNotice('success', 'Event scheduled successfully!');
    },
    onError: (err: Error) => {
      showNotice('error', err.message ?? 'Failed to schedule event. Please try again.');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Events & Locations</h1>
        <p className="text-sm text-text-secondary">Schedule food truck stops and pop-up locations.</p>
      </div>

      {notice && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            notice.type === 'success'
              ? 'bg-green-500/15 text-green-400'
              : 'bg-red-500/15 text-red-400'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-text-secondary">Outlet</label>
        <select
          value={outletId}
          onChange={(e) => setOutletId(e.target.value)}
          className="rounded-lg border border-white/10 bg-bg-primary px-3 py-2 text-sm"
        >
          {(outletsQuery.data ?? []).map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/5 bg-bg-card p-4 sm:grid-cols-2">
        <Input label="Event name" placeholder="Weekend market" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Location" placeholder="BKC, Mumbai" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <Input label="Event date" type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
        <div className="flex gap-2">
          <Input label="Start time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <Input label="End time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!form.name || !form.eventDate || !outletId}
            loading={createMutation.isPending}
          >
            Schedule event
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {eventsQuery.isLoading ? (
          <p className="text-sm text-text-muted">Loading events…</p>
        ) : (eventsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-text-muted">No events scheduled yet.</p>
        ) : (
          (eventsQuery.data ?? []).map((event) => (
            <div key={String(event.id)} className="rounded-lg border border-white/5 bg-bg-card p-4">
              <p className="font-medium">{String(event.name)}</p>
              <p className="text-sm text-text-muted">{String(event.location ?? '')}</p>
              <p className="text-xs text-text-muted">
                {new Date(String(event.eventDate)).toLocaleDateString()} · {String(event.startTime)}–{String(event.endTime)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
