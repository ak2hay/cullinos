import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@/components/ui/Form';
import { inventoryApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function InventoryPage() {
  const queryClient = useQueryClient();
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('kg');
  const [currentStock, setCurrentStock] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('0');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: inventoryApi.listItems,
  });

  const createMutation = useMutation({
    mutationFn: inventoryApi.createItem,
    onSuccess: () => {
      setMessage('Inventory item created.');
      setError(null);
      setName('');
      setSku('');
      setUnit('kg');
      setCurrentStock('0');
      setReorderLevel('0');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="mt-1 max-w-2xl text-text-secondary">
            Track stock items for production and purchasing. Items can be scoped to the selected
            outlet.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Add item'}
        </Button>
      </div>

      {showForm ? (
        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">New inventory item</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              setMessage(null);
              createMutation.mutate({
                outletId: outletId ?? undefined,
                name,
                sku: sku || undefined,
                unit: unit || 'kg',
                currentStock: Number(currentStock) || 0,
                reorderLevel: Number(reorderLevel) || 0,
              });
            }}
          >
            <Input
              label="Item name"
              required
              placeholder="Flour"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="SKU"
              placeholder="Optional"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
            <Input
              label="Unit"
              required
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
            <Input
              label="Current stock"
              type="number"
              min={0}
              step="any"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
            />
            <Input
              label="Reorder level"
              type="number"
              min={0}
              step="any"
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
            />
            {error ? <p className="sm:col-span-2 text-sm text-status-error">{error}</p> : null}
            {message ? <p className="sm:col-span-2 text-sm text-status-success">{message}</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" loading={createMutation.isPending}>
                Create item
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
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Reorder</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Loading inventory…
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{item.sku ?? '—'}</td>
                  <td className="px-4 py-3">{item.unit}</td>
                  <td className="px-4 py-3">{item.currentStock}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {item.reorderLevel ?? 0}
                  </td>
                </tr>
              ))
            )}
            {!isLoading && items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  No inventory items yet. Add your first item above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
