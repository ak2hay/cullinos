import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { INVENTORY_UNIT_OPTIONS } from '@cullinos/shared';
import { Button, Card, CardHeader, Drawer, Input, PageShell, Select } from '@cullinos/ui';
import { inventoryApi, outletsApi, wastageApi } from '@/lib/api';
import { formatPackDefinition, formatPackStock, hasPack } from '@/lib/inventory-packs';
import { useAuthStore } from '@/stores/auth';
import { StockRegisterPanel } from './inventory/StockRegisterPanel';

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
  const [packLabel, setPackLabel] = useState('');
  const [packSize, setPackSize] = useState('');

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
  const [editPackLabel, setEditPackLabel] = useState('');
  const [editPackSize, setEditPackSize] = useState('');

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
  const [adjustInPacks, setAdjustInPacks] = useState(false);

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
    queryKey: ['inventory', 'items', outletId],
    queryFn: () => inventoryApi.listItems(outletId),
    enabled: Boolean(outletId),
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ['inventory', 'low-stock', outletId],
    queryFn: () => inventoryApi.listLowStock(outletId),
    enabled: Boolean(outletId),
  });

  // Transfers need the source outlet's own items, not the selected outlet's.
  const { data: transferSourceItems = [] } = useQuery({
    queryKey: ['inventory', 'items', txFromOutlet],
    queryFn: () => inventoryApi.listItems(txFromOutlet),
    enabled: showTransfer && Boolean(txFromOutlet),
  });

  const { data: wastageRows = [] } = useQuery({
    queryKey: ['wastage', outletId],
    queryFn: () => wastageApi.list(outletId ?? undefined),
  });

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: outletsApi.list,
  });

  const [view, setView] = useState<'outlet' | 'all'>('outlet');
  const [newItemShared, setNewItemShared] = useState(false);
  const multiOutlet = outlets.length > 1;
  const outletName = (id: string | null | undefined) =>
    id ? (outlets.find((o) => o.id === id)?.name ?? 'Outlet') : 'Shared';
  const selectedOutletName = outletName(outletId);

  function openTransfer(fromOutletId?: string, itemId?: string) {
    setTxFromOutlet(fromOutletId ?? outletId ?? '');
    setTxToOutlet('');
    setTxItemId(itemId ?? '');
    setShowTransfer(true);
  }

  const lowStockIds = new Set(lowStock.map((i) => i.id));
  const adjustItem = items.find((i) => i.id === adjustItemId);
  const adjustCanUsePacks = adjustItem ? hasPack(adjustItem) : false;

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
    setEditPackLabel(item.packLabel ?? '');
    setEditPackSize(item.packSize ? String(item.packSize) : '');
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
      setPackLabel(''); setPackSize('');
      setShowForm(false);
      invalidate();
    },
    onError: fail,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: Parameters<typeof inventoryApi.updateItem>[1] & { id: string }) =>
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
        inPacks: adjustCanUsePacks && adjustInPacks ? true : undefined,
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
      description={
        multiOutlet
          ? `Stock at ${selectedOutletName} (plus shared items). Switch outlet from the top bar, or compare all outlets.`
          : 'Track stock items for production and purchasing.'
      }
      actions={
        <div className="flex flex-wrap gap-2">
          {multiOutlet ? (
            <div className="flex rounded-lg border border-line p-0.5 text-sm">
              {(['outlet', 'all'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1.5 transition ${
                    view === v
                      ? 'bg-brand-primary/15 font-medium text-brand-primary'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {v === 'outlet' ? selectedOutletName : 'All outlets'}
                </button>
              ))}
            </div>
          ) : null}
          {multiOutlet ? (
            <Button variant="secondary" onClick={() => openTransfer()}>
              Transfer stock
            </Button>
          ) : null}
          <Button onClick={() => setShowForm(true)}>Add item</Button>
        </div>
      }
    >
      {view === 'all' && multiOutlet ? (
        <OutletStockComparison onTransfer={openTransfer} />
      ) : null}

      <div className={view === 'all' && multiOutlet ? 'hidden' : 'space-y-6'}>
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
              outletId: newItemShared ? undefined : (outletId ?? undefined),
              name, sku: sku || undefined, unit: unit || 'kg',
              currentStock: Number(currentStock) || 0,
              reorderLevel: Number(reorderLevel) || 0,
              packLabel: packLabel.trim() || null,
              packSize: Number(packSize) > 0 ? Number(packSize) : null,
            });
          }}
        >
          {multiOutlet ? (
            <Select
              label="Stock kept at"
              options={[
                { value: 'outlet', label: `${selectedOutletName} only` },
                { value: 'shared', label: 'Shared by all outlets (one common stock)' },
              ]}
              value={newItemShared ? 'shared' : 'outlet'}
              onChange={(e) => setNewItemShared(e.target.value === 'shared')}
            />
          ) : null}
          <Input label="Item name" required placeholder="Flour" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="SKU" placeholder="Optional" value={sku} onChange={(e) => setSku(e.target.value)} />
          <Select label="Unit" required options={INVENTORY_UNIT_OPTIONS} value={unit} onChange={(e) => setUnit(e.target.value)} />
          <PackFields
            unit={unit}
            packLabel={packLabel}
            packSize={packSize}
            onPackLabelChange={setPackLabel}
            onPackSizeChange={setPackSize}
          />
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
              packLabel: editPackLabel.trim() || null,
              packSize: Number(editPackSize) > 0 ? Number(editPackSize) : null,
            });
          }}
        >
          <Input label="Item name" required value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Input label="SKU" placeholder="Optional" value={editSku} onChange={(e) => setEditSku(e.target.value)} />
          <Select label="Unit" required options={INVENTORY_UNIT_OPTIONS} value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
          <PackFields
            unit={editUnit}
            packLabel={editPackLabel}
            packSize={editPackSize}
            onPackLabelChange={setEditPackLabel}
            onPackSizeChange={setEditPackSize}
          />
          <Input label="Current stock" type="number" min={0} step="any" value={editStock} onChange={(e) => setEditStock(e.target.value)} />
          <Input label="Reorder level" type="number" min={0} step="any" value={editReorder} onChange={(e) => setEditReorder(e.target.value)} />
          {editItem ? <InventoryLotsPreview itemId={editItem.id} /> : null}
        </form>
      </Drawer>

      {/* ── Delete confirmation ── */}
      {deleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-bg-card p-6 shadow-2xl">
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
              onChange={(e) => { setTxFromOutlet(e.target.value); setTxItemId(''); }}
              required
              className="block h-11 w-full rounded-lg border border-line bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
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
              className="block h-11 w-full rounded-lg border border-line bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
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
              className="block h-11 w-full rounded-lg border border-line bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
            >
              <option value="">{txFromOutlet ? 'Select item…' : 'Choose the source outlet first'}</option>
              {(txFromOutlet ? transferSourceItems : []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.currentStock} {item.unit}
                  {item.outletId ? '' : ' · shared'})
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
              onChange={(e) => { setAdjustItemId(e.target.value); setAdjustInPacks(false); }}
              className="block h-11 w-full rounded-lg border border-line bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
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
          <div className="space-y-1">
            <Input
              label={
                adjustCanUsePacks && adjustInPacks
                  ? `Quantity (${adjustItem?.packLabel || 'pack'}s)`
                  : `Quantity${adjustItem ? ` (${adjustItem.unit})` : ''}`
              }
              type="number"
              min={0.001}
              step="any"
              required
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
            />
            {adjustCanUsePacks && adjustItem ? (
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={adjustInPacks}
                  onChange={(e) => setAdjustInPacks(e.target.checked)}
                />
                Enter in {adjustItem.packLabel || 'pack'}s ({formatPackDefinition(adjustItem)})
              </label>
            ) : null}
          </div>
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">Type</span>
            <select
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value as 'in' | 'out' | 'waste')}
              className="block h-11 w-full rounded-lg border border-line bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
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
              className="block h-11 w-full rounded-lg border border-line bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
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
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line-subtle">
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
            <tr className="border-b border-line-subtle bg-bg-secondary text-text-muted">
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
                    className={`border-b border-line-subtle ${isLow ? 'bg-status-warning/5' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {item.name}
                      {multiOutlet && !item.outletId ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-hover px-2 py-0.5 text-xs font-normal text-text-muted">
                          Shared
                        </span>
                      ) : null}
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
                      {formatPackStock(item) ? (
                        <span className="block text-xs font-normal text-text-muted">
                          {formatPackStock(item)}
                        </span>
                      ) : null}
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

      <StockRegisterPanel outletId={outletId} />
      </div>
    </PageShell>
  );
}

function OutletStockComparison({
  onTransfer,
}: {
  onTransfer: (fromOutletId?: string, itemId?: string) => void;
}) {
  const matrixQuery = useQuery({
    queryKey: ['inventory', 'outlet-stock'],
    queryFn: inventoryApi.outletStock,
  });
  const [lowOnly, setLowOnly] = useState(false);
  const outlets = matrixQuery.data?.outlets ?? [];
  const allRows = matrixQuery.data?.rows ?? [];
  const hasShared = allRows.some((r) => r.shared);
  const rows = lowOnly
    ? allRows.filter((r) => r.shared?.low || Object.values(r.byOutlet).some((c) => c.low))
    : allRows;

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle px-4 py-3">
        <div>
          <p className="text-sm font-medium">Stock across outlets</p>
          <p className="text-xs text-text-muted">
            Each outlet keeps its own stock. Sales deduct from the selling outlet; move stock with
            Transfer.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-primary"
            checked={lowOnly}
            onChange={(e) => setLowOnly(e.target.checked)}
          />
          Low stock only
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line-subtle bg-bg-secondary text-text-muted">
              <th className="px-4 py-3 font-medium">Item</th>
              {hasShared ? <th className="px-4 py-3 font-medium">Shared</th> : null}
              {outlets.map((o) => (
                <th key={o.id} className="px-4 py-3 font-medium">
                  {o.name}
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {matrixQuery.isLoading ? (
              <tr>
                <td colSpan={outlets.length + 3} className="px-4 py-8 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={outlets.length + 3} className="px-4 py-8 text-center text-text-muted">
                  {lowOnly ? 'No low-stock items at any outlet.' : 'No inventory items yet.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="border-b border-line-subtle">
                  <td className="px-4 py-3">
                    <span className="font-medium">{row.name}</span>
                    <span className="ml-1 text-xs text-text-muted">({row.unit})</span>
                  </td>
                  {hasShared ? (
                    <td className="px-4 py-3">
                      <StockCell cell={row.shared} />
                    </td>
                  ) : null}
                  {outlets.map((o) => {
                    const cell = row.byOutlet[o.id] ?? null;
                    return (
                      <td key={o.id} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StockCell cell={cell} />
                          {cell && cell.stock > 0 ? (
                            <button
                              type="button"
                              onClick={() => onTransfer(o.id, cell.itemId)}
                              className="text-xs text-brand-primary hover:underline"
                              title={`Transfer ${row.name} from ${o.name}`}
                            >
                              Move
                            </button>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 font-medium">{row.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StockCell({ cell }: { cell: { stock: number; low: boolean } | null }) {
  if (!cell) return <span className="text-text-muted">—</span>;
  return (
    <span className={cell.low ? 'font-semibold text-status-warning' : ''}>
      {cell.stock}
      {cell.low ? <span className="ml-1 text-xs">Low</span> : null}
    </span>
  );
}

function PackFields({
  unit,
  packLabel,
  packSize,
  onPackLabelChange,
  onPackSizeChange,
}: {
  unit: string;
  packLabel: string;
  packSize: string;
  onPackLabelChange: (v: string) => void;
  onPackSizeChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-line-subtle bg-bg-elevated/40 p-3">
      <p className="text-xs font-medium text-text-secondary">Purchase pack (optional)</p>
      <p className="mt-0.5 text-xs text-text-muted">
        Buy in packets, buckets or bottles? Stock stays in {unit}; packs make receiving easier.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Input
          label="Pack name"
          placeholder="packet"
          value={packLabel}
          onChange={(e) => onPackLabelChange(e.target.value)}
        />
        <Input
          label={`${unit} per pack`}
          type="number"
          min={0}
          step="any"
          placeholder="50"
          value={packSize}
          onChange={(e) => onPackSizeChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function InventoryLotsPreview({ itemId }: { itemId: string }) {
  const lotsQuery = useQuery({
    queryKey: ['inventory', 'lots', itemId],
    queryFn: () => inventoryApi.listLots(itemId),
  });
  const lots = lotsQuery.data ?? [];

  return (
    <div className="rounded-lg border border-line-subtle bg-bg-elevated/40 p-3">
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
