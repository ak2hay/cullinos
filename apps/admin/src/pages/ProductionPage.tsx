import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input, PageHeader, useToast } from '@cullinos/ui';
import { outletsApi, productionApi } from '@/lib/api';

export function ProductionPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    plannedQty: '24',
    scheduledFor: '',
    batchNumber: '',
  });

  function showNotice(type: 'success' | 'error', text: string) {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  }

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
      showNotice('success', 'Batch scheduled successfully!');
    },
    onError: (err: Error) => {
      showNotice('error', err.message ?? 'Failed to schedule batch. Please try again.');
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => productionApi.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production'] });
      showNotice('success', 'Batch marked as completed! Stock will be deducted automatically if the batch has a linked recipe with ingredients.');
    },
    onError: (err: Error) => {
      showNotice('error', err.message ?? 'Failed to complete batch. Please try again.');
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production"
        description="Daily bake sheets, batch planning, and stock deduction."
      />

      <div className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="mb-4 font-semibold">Schedule new batch</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Batch name" placeholder="Morning sourdough" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Planned qty" placeholder="24" value={form.plannedQty} onChange={(e) => setForm({ ...form, plannedQty: e.target.value })} />
          <Input label="Scheduled for" type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} />
          <Input label="Batch number" placeholder="BATCH-001" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
          <div className="sm:col-span-2">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.name || !form.scheduledFor}
              loading={createMutation.isPending}
            >
              Schedule batch
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Tip: Stock is automatically deducted when you complete a batch that is linked to a recipe with ingredients.
          Batches without a recipe will be marked as completed without stock deduction.
        </p>
      </div>

      <div className="space-y-2">
        {batchesQuery.isLoading ? (
          <p className="text-sm text-text-muted">Loading batches…</p>
        ) : (batchesQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-text-muted">No batches scheduled yet.</p>
        ) : (
          (batchesQuery.data ?? []).map((batch) => (
            <div key={String(batch.id)} className="flex items-center justify-between rounded-lg border border-white/5 bg-bg-card p-4">
              <div>
                <p className="font-medium">{String(batch.name)}</p>
                <p className="text-sm text-text-muted">
                  Qty {String(batch.plannedQty)} · <span className="capitalize">{String(batch.status)}</span>
                  {batch.batchNumber ? ` · ${String(batch.batchNumber)}` : ''}
                </p>
                <p className="text-xs text-text-muted">
                  {new Date(String(batch.scheduledFor)).toLocaleString()}
                </p>
              </div>
              {batch.status !== 'completed' ? (
                <Button
                  onClick={() => completeMutation.mutate(String(batch.id))}
                  loading={completeMutation.isPending}
                >
                  Mark complete
                </Button>
              ) : (
                <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs text-green-400">Done</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
