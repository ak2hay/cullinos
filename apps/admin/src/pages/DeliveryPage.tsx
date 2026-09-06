import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Button,
  DataTable,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
  useToast,
} from '@cullinos/ui';
import { deliveryApi, outletsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function DeliveryPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const [outletId, setOutletId] = useState('');
  const [form, setForm] = useState({
    name: '',
    pincode: '',
    minOrder: '',
    fee: '',
    estimatedMinutes: '',
  });

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const zonesQuery = useQuery({
    queryKey: ['delivery', 'zones'],
    queryFn: deliveryApi.list,
  });

  useEffect(() => {
    if (outletId) return;
    if (selectedOutletId) {
      setOutletId(selectedOutletId);
      return;
    }
    if (outletsQuery.data?.[0]?.id) setOutletId(outletsQuery.data[0].id);
  }, [outletId, selectedOutletId, outletsQuery.data]);

  const createMutation = useMutation({
    mutationFn: () =>
      deliveryApi.createZone({
        name: form.name.trim(),
        outletId: outletId || undefined,
        pincode: form.pincode.trim() || undefined,
        minOrder: form.minOrder ? Number(form.minOrder) : undefined,
        fee: form.fee ? Number(form.fee) : undefined,
        estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
      setForm({ name: '', pincode: '', minOrder: '', fee: '', estimatedMinutes: '' });
      toast.success('Delivery zone created.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create zone.'),
  });

  const zones = zonesQuery.data ?? [];
  const outletOptions = (outletsQuery.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery zones"
        description="Delivery areas, fees, and minimum order amounts for your outlets."
      />

      {zonesQuery.error ? (
        <ErrorBanner>
          {zonesQuery.error instanceof Error
            ? zonesQuery.error.message
            : 'Failed to load delivery zones'}
        </ErrorBanner>
      ) : null}

      <div className="grid gap-3 rounded-xl border border-white/5 bg-bg-card p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Select
            label="Outlet"
            options={outletOptions}
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
          />
        </div>
        <Input
          label="Zone name"
          placeholder="South Mumbai"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Pincode (optional)"
          placeholder="400001"
          value={form.pincode}
          onChange={(e) => setForm({ ...form, pincode: e.target.value })}
        />
        <Input
          label="Delivery fee (₹)"
          type="number"
          value={form.fee}
          onChange={(e) => setForm({ ...form, fee: e.target.value })}
        />
        <Input
          label="Min order (₹)"
          type="number"
          value={form.minOrder}
          onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
        />
        <Input
          label="Est. minutes"
          type="number"
          value={form.estimatedMinutes}
          onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })}
        />
        <div className="flex items-end sm:col-span-2">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!form.name.trim()}
            loading={createMutation.isPending}
          >
            Add zone
          </Button>
        </div>
      </div>

      <DataTable
        columns={[
          {
            key: 'name',
            header: 'Zone',
            cell: (zone) => <span className="font-medium">{zone.name}</span>,
          },
          {
            key: 'pincode',
            header: 'Pincode',
            cell: (zone) => {
              const meta =
                zone.polygon && typeof zone.polygon === 'object' ? zone.polygon : null;
              return (
                <span className="text-text-secondary">{meta?.pincode ?? '—'}</span>
              );
            },
          },
          {
            key: 'fee',
            header: 'Delivery fee',
            cell: (zone) => (
              <span className="font-mono">₹{Number(zone.deliveryFee).toFixed(0)}</span>
            ),
          },
          {
            key: 'min',
            header: 'Min order',
            cell: (zone) => (
              <span className="font-mono">₹{Number(zone.minOrder).toFixed(0)}</span>
            ),
          },
          {
            key: 'eta',
            header: 'ETA',
            cell: (zone) => {
              const meta =
                zone.polygon && typeof zone.polygon === 'object' ? zone.polygon : null;
              return (
                <span className="text-text-secondary">
                  {meta?.estimatedMinutes != null ? `${meta.estimatedMinutes} min` : '—'}
                </span>
              );
            },
          },
        ]}
        rows={zones}
        getRowKey={(zone) => zone.id}
        loading={zonesQuery.isLoading}
        emptyMessage="No delivery zones configured yet."
      />
    </div>
  );
}
