import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@/components/ui/Form';
import { tablesApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const TABLE_STATUSES = ['available', 'occupied', 'reserved', 'cleaning', 'billing'] as const;

export function TablesPage() {
  const queryClient = useQueryClient();
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['tables', outletId],
    queryFn: () => tablesApi.listByOutlet(outletId!),
    enabled: !!outletId,
  });

  const createMutation = useMutation({
    mutationFn: tablesApi.create,
    onSuccess: () => {
      setMessage('Table created.');
      setError(null);
      setName('');
      setCapacity('4');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ tableId, status }: { tableId: string; status: string }) =>
      tablesApi.updateStatus(outletId!, tableId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  if (!outletId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Tables</h1>
        <p className="text-text-secondary">Select an outlet to manage tables.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tables</h1>
          <p className="mt-1 max-w-2xl text-text-secondary">
            Create dining tables for this outlet. Waiter and QR ordering use these tables.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Add table'}
        </Button>
      </div>

      {showForm ? (
        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">New table</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              setMessage(null);
              createMutation.mutate({
                outletId,
                name,
                capacity: Number(capacity) || 4,
              });
            }}
          >
            <Input
              label="Table name"
              required
              placeholder="T1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Capacity"
              type="number"
              min={1}
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            {error ? <p className="sm:col-span-2 text-sm text-status-error">{error}</p> : null}
            {message ? <p className="sm:col-span-2 text-sm text-status-success">{message}</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" loading={createMutation.isPending}>
                Create table
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {!showForm && error ? <p className="text-sm text-status-error">{error}</p> : null}
      {!showForm && message ? <p className="text-sm text-status-success">{message}</p> : null}

      <section className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Section</th>
              <th className="px-4 py-3 font-medium">Capacity</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">QR</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Loading tables…
                </td>
              </tr>
            ) : (
              tables.map((table) => (
                <tr key={table.id} className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium">{table.name}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {table.section?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">{table.capacity}</td>
                  <td className="px-4 py-3">
                    <select
                      value={table.status}
                      onChange={(e) =>
                        statusMutation.mutate({ tableId: table.id, status: e.target.value })
                      }
                      className="rounded-lg border border-white/10 bg-bg-elevated px-2 py-1.5 text-sm capitalize outline-none focus:border-brand-primary"
                    >
                      {TABLE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {table.qrCode ?? '—'}
                  </td>
                </tr>
              ))
            )}
            {!isLoading && tables.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  No tables yet. Add your first table above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
