import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { INVENTORY_UNIT_OPTIONS } from '@cullinos/shared';
import { Button, Card, CardHeader, Drawer, Input, PageShell, Select } from '@cullinos/ui';
import { inventoryApi, outletsApi, wastageApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

type SortField = 'name' | 'stock' | 'reorder';
type SortDir = 'asc' | 'desc';

function SortButton({
  field,
  label,
  current,
  dir,
  onSort,
}: {
  field: SortField;
  label: string;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = field === current;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center gap-1 font-medium hover:text-text-primary transition"
    >
      {label}
      <span className={`text-xs ${active ? 'text-brand-primary' : 'text-text-muted'}`}>
        {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );
}

export function InventoryPage() {
  const queryClient = useQueryClient();
  const outletId = useAuthStore((s) => s.selectedOutletId);

  // ─── create form ───────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('kg');
  const [currentStock, setCurrentStock] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('0');

  // ─── edit form ─────────────────────────────────────────────────
  const [editItem, setEditItem] = useState<null | {
    id: string;
    name: string;
    sku: string | null;
    unit: string;
    currentStock: number;
    reorderLevel?: number;
  }>(null);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editUnit, setEditUnit] = useState('kg');
  const [editStock, setEditStock] = useState('0');
  const [editReorder, setEditReorder] = useState('0');

  // ─── delete confirm ────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ─── transfer form ─────────────────────────────────────────────
  const [showTransfer, setShowTransfer] = useState(false);
  const [txFromOutlet, setTxFromOutlet] = useState('');
  const [txToOutlet, setTxToOutlet] = useState('');
  const [txItemId, setTxItemId] = useState('');
  const [txQty, setTxQty] = useState('1');
  const [txNotes, setTxNotes] = useState('');

  // ─── adjust ────────────────────────────────────────────────────
  const [adjustItemId, setAdjustItemId] = useState('');
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustType, setAdjustType] = useState<'in' | 'out' | 'waste'>('in');
  const [adjustNotes, setAdjustNotes] = useState('');

  // ─── wastage ───────────────────────────────────────────────────
  const [wasteItemId, setWasteItemId] = useState('');
  const [wasteQty, setWasteQty] = useState('1');
  const [wasteReason, setWasteReason] = useState('');

  // ─── table state ───────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterLowStock, setFilterLowStock] = useState(false);

  // ─── messages ──────────────────────────────────────────────────
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function notify(msg: string) {
    setMessage(msg);
    setError(null);
  }
  function fail(err: Error) {
    setError(err.message);
    setMessage(null);
  }

  // ─── queries ───────────────────────────────────────────────────
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: inventoryApi.listItems,
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: inventoryApi.listLowStock,
  });

  const { data: wastageRows = [] } = useQuery({
    queryKey: ['wastage', outletId],
    queryFn: () => wastageApi.list(outletId ?? undefined),
  });

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: outletsApi.list,
  });

  const lowStockIds = new Set(lowStock.map((i) => i.id));

  // ─── sorted + filtered items ───────────────────────────────────
  const displayItems = [...items]
    .filter((i) => !filterLowStock || lowStockIds.has(i.id))
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'stock') cmp = a.currentStock - b.currentStock;
      else if (sortField === 'reorder') cmp = (a.reorderLevel ?? 0) - (b.reorderLevel ?? 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }

  function openEdit(item: typeof items[number]) {
    setEditItem(item);
    setEditName(item.name);
    setEditSku(item.sku ?? '');
    setEditUnit(item.unit);
    setEditStock(String(item.currentStock));
    setEditReorder(String(item.reorderLevel ?? 0));
  }

  // ─── mutations ─────────────────────────────────────────────────
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  }

  const createMutation = useMutation({
    mutationFn: inventoryApi.createItem,
    onSuccess: () => {
      notify('Inventory item created.');
      setName(''); setSku(''); setUnit('kg'); setCurrentStock('0'); setReorderLevel('0');
      setShowForm(false);
      invalidate();
    },
    onError: fail,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; sku?: string; unit?: string; currentStock?: number; reorderLevel?: number }) =>
      inventoryApi.updateItem(id, payload),
    onSuccess: () => {
      notify('Item updated.');
      setEditItem(null);
      invalidate();
    },
    onError: fail,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.deleteItem(id),
    onSuccess: () => {
      notify('Item deleted.');
      setDeleteId(null);
      invalidate();
    },
    onError: fail,
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      inventoryApi.transfer({
        fromOutletId: txFromOutlet,
        toOutletId: txToOutlet,
        inventoryItemId: txItemId,
        quantity: Number(txQty),
        notes: txNotes || undefined,
      }),
    onSuccess: () => {
      notify('Stock transferred.');
      setShowTransfer(false);
      setTxFromOutlet(''); setTxToOutlet(''); setTxItemId(''); setTxQty('1'); setTxNotes('');
      invalidate();
    },
    onError: fail,
  });

  const adjustMutation = useMutation({
    mutationFn: () =>
      inventoryApi.adjust(adjustItemId, {
        quantity: Number(adjustQty),
        type: adjustType,
        notes: adjustNotes || undefined,
      }),
    onSuccess: () => {
      notify('Stock adjusted.');
      setAdjustQty('1'); setAdjustNotes('');
      invalidate();
    },
    onError: fail,
  });

  const wastageMutation = useMutation({
    mutationFn: () =>
      wastageApi.create({
        inventoryItemId: wasteItemId,
        quantity: Number(wasteQty),
        reason: wasteReason || undefined,
        outletId: outletId ?? undefined,
      }),
    onSuccess: () => {
      notify('Wastage recorded.');
      setWasteQty('1'); setWasteReason('');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['wastage'] });
    },
    onError: fail,
  });

  return (
    <PageShell
      title="Inventory"
      description="Track stock items for production and purchasing."
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowTransfer(true)}>
            Transfer stock
          </Button>
          <Button onClick={() => setShowForm(true)}>Add item</Button>
        </div>
      }
    >
      {/* ── Low-stock alert ── */}
      {lowStock.length > 0 ? (
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-status-warning">
                ⚠ {lowStock.length} item{lowStock.length === 1 ? '' : 's'} at or below reorder level
              </p>
              <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {lowStock.slice(0, 8).map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-text-secondary">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-warning shrink-0" />
                    <span className="font-medium">{i.name}</span>
                    <span className="text-text-muted">
                      {i.currentStock} / {i.reorderLevel ?? 0} {i.unit}
                    </span>
                  </li>
                ))}
              </ul>
              {lowStock.length > 8 ? (
                <p className="mt-1 text-text-muted">+{lowStock.length - 8} more</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setFilterLowStock((v) => !v)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filterLowStock
                  ? 'bg-status-warning/30 text-status-warning'
                  : 'bg-status-warning/10 text-status-warning hover:bg-status-warning/20'
              }`}
            >
              {filterLowStock ? 'Show all' : 'Filter low-stock'}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Global messages ── */}
      {error ? <p className="text-sm text-status-error">{error}</p> : null}
      {message ? <p className="text-sm text-status-success">{message}</p> : null}

      {/* ── Create item drawer ── */}
      <Drawer
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New inventory item"
        footer={
          <Button type="submit" form="inventory-create-form" loading={createMutation.isPending}>
            Create item
          </Button>
        }
      >
        <form
          id="inventory-create-form"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              outletId: outletId ?? undefined,
              name, sku: sku || undefined, unit: unit || 'kg',
              currentStock: Number(currentStock) || 0,
              reorderLevel: Number(reorderLevel) || 0,
            });
          }}
        >
          <Input label="Item name" required placeholder="Flour" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="SKU" placeholder="Optional" value={sku} onChange={(e) => setSku(e.target.value)} />
          <Select label="Unit" required options={INVENTORY_UNIT_OPTIONS} value={unit} onChange={(e) => setUnit(e.target.value)} />
          <Input label="Current stock" type="number" min={0} step="any" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} />
          <Input label="Reorder level" type="number" min={0} step="any" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
        </form>
      </Drawer>

      {/* ── Edit item drawer ── */}
      <Drawer
        open={editItem !== null}
        onClose={() => setEditItem(null)}
        title="Edit inventory item"
        footer={
          <div className="flex justify-between gap-2">
            <Button
              variant="danger"
              onClick={() => {
                if (editItem) { setDeleteId(editItem.id); setEditItem(null); }
              }}
            >
              Delete
            </Button>
            <Button
              type="submit"
              form="inventory-edit-form"
              loading={updateMutation.isPending}
            >
              Save changes
            </Button>
          </div>
        }
      >
        <form
          id="inventory-edit-form"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editItem) return;
            updateMutation.mutate({
              id: editItem.id,
              name: editName,
              sku: editSku || undefined,
              unit: editUnit,
              currentStock: Number(editStock),
              reorderLevel: Number(editReorder),
            });
          }}
        >
          <Input label="Item name" required value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Input label="SKU" placeholder="Optional" value={editSku} onChange={(e) => setEditSku(e.target.value)} />
          <Select label="Unit" required options={INVENTORY_UNIT_OPTIONS} value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
          <Input label="Current stock" type="number" min={0} step="any" value={editStock} onChange={(e) => setEditStock(e.target.value)} />
          <Input label="Reorder level" type="number" min={0} step="any" value={editReorder} onChange={(e) => setEditReorder(e.target.value)} />
          {editItem ? <InventoryLotsPreview itemId={editItem.id} /> : null}
        </form>
      </Drawer>

      {/* ── Delete confirmation ── */}
      {deleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-bg-card p-6 shadow-2xl">
            <h2 className="font-semibold">Delete inventory item?</h2>
            <p className="mt-2 text-sm text-text-secondary">
              This will permanently remove the item and its stock history.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteId)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Transfer drawer ── */}
      <Drawer
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        title="Transfer stock between outlets"
        footer={
          <Button
            type="submit"
            form="inventory-transfer-form"
            loading={transferMutation.isPending}
          >
            Transfer
          </Button>
        }
      >
        <form
          id="inventory-transfer-form"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!txFromOutlet || !txToOutlet || !txItemId) {
              fail(new Error('Select source outlet, destination, and item.'));
              return;
            }
            if (txFromOutlet === txToOutlet) {
              fail(new Error('Source and destination must differ.'));
              return;
            }
            transferMutation.mutate();
          }}
        >
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">From outlet</span>
            <select
              value={txFromOutlet}
              onChange={(e) => setTxFromOutlet(e.target.value)}
              required
              className="block h-11 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
            >
              <option value="">Select outlet…</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">To outlet</span>
            <select
              value={txToOutlet}
              onChange={(e) => setTxToOutlet(e.target.value)}
              required
              className="block h-11 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
            >
              <option value="">Select outlet…</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">Item</span>
            <select
              value={txItemId}
              onChange={(e) => setTxItemId(e.target.value)}
              required
              className="block h-11 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
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
            value={txQty}
            onChange={(e) => setTxQty(e.target.value)}
          />
          <Input
            label="Notes"
            placeholder="Optional"
            value={txNotes}
            onChange={(e) => setTxNotes(e.target.value)}
          />
        </form>
      </Drawer>

      {/* ── Adjust stock ── */}
      <Card>
        <CardHeader title="Adjust stock" />
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!adjustItemId) { fail(new Error('Select an item to adjust.')); return; }
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
      </Card>

      {/* ── Record wastage ── */}
      <Card>
        <CardHeader title="Record wastage" />
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!wasteItemId) { fail(new Error('Select an item for wastage.')); return; }
            wastageMutation.mutate();
          }}
        >
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">Item</span>
            <select
              value={wasteItemId}
              onChange={(e) => setWasteItemId(e.target.value)}
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
            value={wasteQty}
            onChange={(e) => setWasteQty(e.target.value)}
          />
          <Input
            label="Reason"
            placeholder="Spoilage, breakage…"
            value={wasteReason}
            onChange={(e) => setWasteReason(e.target.value)}
          />
          <div className="flex items-end">
            <Button type="submit" loading={wastageMutation.isPending}>
              Record wastage
            </Button>
          </div>
        </form>
      </Card>

      {/* ── Recent wastage ── */}
      {wastageRows.length > 0 ? (
        <Card>
          <CardHeader title="Recent wastage" />
          <ul className="space-y-2 text-sm">
            {wastageRows.slice(0, 10).map((row) => (
              <li key={row.id} className="flex justify-between gap-4 text-text-secondary">
                <span>
                  {row.inventoryItem?.name ?? 'Item'} — {Number(row.quantity)}{' '}
                  {row.inventoryItem?.unit ?? ''}
                  {row.reason ? ` (${row.reason})` : ''}
                </span>
                <span className="shrink-0 text-text-muted">
                  {new Date(row.recordedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ── Items table ── */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/5">
          <span className="text-sm font-medium">
            {filterLowStock
              ? `${displayItems.length} low-stock item${displayItems.length === 1 ? '' : 's'}`
              : `${items.length} item${items.length === 1 ? '' : 's'}`}
          </span>
          {filterLowStock ? (
            <button
              type="button"
              onClick={() => setFilterLowStock(false)}
              className="text-xs text-brand-primary hover:underline"
            >
              Show all
            </button>
          ) : null}
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
              <th className="px-4 py-3">
                <SortButton field="name" label="Name" current={sortField} dir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3">
                <SortButton field="stock" label="Stock" current={sortField} dir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-3">
                <SortButton field="reorder" label="Reorder" current={sortField} dir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  Loading inventory…
                </td>
              </tr>
            ) : (
              displayItems.map((item) => {
                const isLow = lowStockIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-white/5 ${isLow ? 'bg-status-warning/5' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {item.name}
                      {isLow ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-status-warning/15 px-2 py-0.5 text-xs font-semibold text-status-warning">
                          Low
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{item.sku ?? '—'}</td>
                    <td className="px-4 py-3">{item.unit}</td>
                    <td className={`px-4 py-3 ${isLow ? 'font-bold text-status-warning' : ''}`}>
                      {item.currentStock}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {item.reorderLevel ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="text-xs text-brand-primary hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
            {!isLoading && displayItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  {filterLowStock
                    ? 'No low-stock items — great job!'
                    : 'No inventory items yet. Add your first item above.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}

function InventoryLotsPreview({ itemId }: { itemId: string }) {
  const lotsQuery = useQuery({
    queryKey: ['inventory', 'lots', itemId],
    queryFn: () => inventoryApi.listLots(itemId),
  });
  const lots = lotsQuery.data ?? [];

  return (
    <div className="rounded-lg border border-white/5 bg-bg-elevated/40 p-3">
      <p className="text-xs font-medium text-text-secondary">FIFO lots</p>
      {lotsQuery.isLoading ? (
        <p className="mt-1 text-xs text-text-muted">Loading…</p>
      ) : lots.length === 0 ? (
        <p className="mt-1 text-xs text-text-muted">No open lots (GRN confirm creates lots).</p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs text-text-secondary">
          {lots.map((lot) => (
            <li key={lot.id} className="flex justify-between gap-2 font-mono">
              <span>{lot.qtyRemaining} @ ₹{lot.unitCost}</span>
              <span className="text-text-muted">
                {new Date(lot.receivedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
