import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const eventsQuery = useQuery({
    queryKey: ['events', outletId],
    queryFn: () => eventsApi.list(outletId || undefined),
    enabled: Boolean(outletId || outletsQuery.data?.length),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      eventsApi.create({
        outletId: outletId || outletsQuery.data?.[0]?.id,
        ...form,
        eventDate: new Date(form.eventDate).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setForm({ name: '', location: '', eventDate: '', startTime: '11:00', endTime: '15:00' });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Events & Locations</h1>
        <p className="text-sm text-text-secondary">Schedule food truck stops and pop-up locations.</p>
      </div>

      <select
        value={outletId}
        onChange={(e) => setOutletId(e.target.value)}
        className="rounded-lg border border-white/10 bg-bg-primary px-3 py-2 text-sm"
      >
        <option value="">All outlets</option>
        {(outletsQuery.data ?? []).map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>

      <div className="grid gap-3 rounded-xl border border-white/5 bg-bg-card p-4 sm:grid-cols-2">
        <Input placeholder="Event name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <Input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
        <div className="flex gap-2">
          <Input value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <Input value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.eventDate}>
          Add event
        </Button>
      </div>

      <div className="space-y-2">
        {(eventsQuery.data ?? []).map((event) => (
          <div key={String(event.id)} className="rounded-lg border border-white/5 bg-bg-card p-4">
            <p className="font-medium">{String(event.name)}</p>
            <p className="text-sm text-text-muted">{String(event.location ?? '')}</p>
            <p className="text-xs text-text-muted">
              {new Date(String(event.eventDate)).toLocaleDateString()} · {String(event.startTime)}–{String(event.endTime)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
