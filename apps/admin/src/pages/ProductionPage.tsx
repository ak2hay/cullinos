import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@/components/ui/Form';
import { outletsApi, productionApi } from '@/lib/api';

export function ProductionPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    plannedQty: '24',
    scheduledFor: '',
    batchNumber: '',
  });

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const outletId = outletsQuery.data?.[0]?.id;

  const batchesQuery = useQuery({
    queryKey: ['production', outletId],
    queryFn: () => productionApi.list(outletId),
    enabled: Boolean(outletId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      productionApi.create({
        outletId,
        name: form.name,
        plannedQty: Number(form.plannedQty),
        batchNumber: form.batchNumber || undefined,
        scheduledFor: new Date(form.scheduledFor).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production'] });
      setForm({ name: '', plannedQty: '24', scheduledFor: '', batchNumber: '' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => productionApi.complete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['production'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Production</h1>
        <p className="text-sm text-text-secondary">Daily bake sheets, batch planning, and stock deduction.</p>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/5 bg-bg-card p-4 sm:grid-cols-2">
        <Input placeholder="Batch name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Planned qty" value={form.plannedQty} onChange={(e) => setForm({ ...form, plannedQty: e.target.value })} />
        <Input type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} />
        <Input placeholder="Batch number" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
        <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.scheduledFor}>
          Schedule batch
        </Button>
      </div>

      <div className="space-y-2">
        {(batchesQuery.data ?? []).map((batch) => (
          <div key={String(batch.id)} className="flex items-center justify-between rounded-lg border border-white/5 bg-bg-card p-4">
            <div>
              <p className="font-medium">{String(batch.name)}</p>
              <p className="text-sm text-text-muted">
                Qty {String(batch.plannedQty)} · {String(batch.status)}
              </p>
            </div>
            {batch.status !== 'completed' ? (
              <Button onClick={() => completeMutation.mutate(String(batch.id))}>Complete</Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
