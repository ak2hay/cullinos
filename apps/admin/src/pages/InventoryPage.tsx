import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { INVENTORY_UNIT_OPTIONS } from '@cullinos/shared';
import { Button, Input, Select } from '@cullinos/ui';
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

  const [adjustItemId, setAdjustItemId] = useState('');
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustType, setAdjustType] = useState<'in' | 'out' | 'waste'>('in');
  const [adjustNotes, setAdjustNotes] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: inventoryApi.listItems,
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: inventoryApi.listLowStock,
  });

  const lowStockIds = new Set(lowStock.map((i) => i.id));

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
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const adjustMutation = useMutation({
    mutationFn: () =>
      inventoryApi.adjust(adjustItemId, {
        quantity: Number(adjustQty),
        type: adjustType,
        notes: adjustNotes || undefined,
      }),
    onSuccess: () => {
      setMessage('Stock adjusted.');
      setError(null);
      setAdjustQty('1');
      setAdjustNotes('');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
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

      {lowStock.length > 0 ? (
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm">
          <p className="font-medium text-status-warning">
            {lowStock.length} item{lowStock.length === 1 ? '' : 's'} at or below reorder level
          </p>
          <p className="mt-1 text-text-secondary">
            {lowStock
              .slice(0, 5)
              .map((i) => i.name)
              .join(', ')}
            {lowStock.length > 5 ? ` (+${lowStock.length - 5} more)` : ''}
          </p>
        </div>
      ) : null}

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
            <Select
              label="Unit"
              required
              options={INVENTORY_UNIT_OPTIONS}
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

      <section className="rounded-xl border border-white/5 bg-bg-card p-6">
        <h2 className="font-medium">Adjust stock</h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setMessage(null);
            if (!adjustItemId) {
              setError('Select an item to adjust.');
              return;
            }
            adjustMutation.mutate();
          }}
        >
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">Item</span>
            <select
              value={adjustItemId}
              onChange={(e) => setAdjustItemId(e.target.value)}
              className="block h-11 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
              required
            >
              <option value="">Select item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.currentStock} {item.unit})
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Quantity"
            type="number"
            min={0.001}
            step="any"
            required
            value={adjustQty}
            onChange={(e) => setAdjustQty(e.target.value)}
          />
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">Type</span>
            <select
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value as 'in' | 'out' | 'waste')}
              className="block h-11 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
            >
              <option value="in">In (+)</option>
              <option value="out">Out (−)</option>
              <option value="waste">Waste (−)</option>
            </select>
          </label>
          <Input
            label="Notes"
            placeholder="Optional"
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
          />
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" loading={adjustMutation.isPending}>
              Apply adjustment
            </Button>
          </div>
        </form>
      </section>

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
              items.map((item) => {
                const isLow = lowStockIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-white/5 ${
                      isLow ? 'bg-status-warning/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {item.name}
                      {isLow ? (
                        <span className="ml-2 text-xs font-normal text-status-warning">
                          Low stock
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{item.sku ?? '—'}</td>
                    <td className="px-4 py-3">{item.unit}</td>
                    <td
                      className={`px-4 py-3 ${isLow ? 'font-semibold text-status-warning' : ''}`}
                    >
                      {item.currentStock}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {item.reorderLevel ?? 0}
                    </td>
                  </tr>
                );
              })
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
