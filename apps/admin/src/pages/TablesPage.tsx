import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Card, CardHeader, Drawer, Input, PageShell } from '@cullinos/ui';
import {
  outletsApi,
  organizationsApi,
  settingsApi,
  tablesApi,
  type DiningTable,
  type FloorPlanFloor,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const GUEST_APP_BASE =
  (import.meta.env.VITE_GUEST_APP_URL as string | undefined) ??
  'https://guest.cullinos.com';

const TABLE_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'BILLING'] as const;

function tableFloorId(table: DiningTable): string | null {
  return table.section?.floor?.id ?? null;
}

const STATUS_STYLE: Record<string, { tile: string; badge: 'success' | 'error' | 'warning' | 'neutral' | 'info' }> = {
  AVAILABLE: { tile: 'border-table-available/40 bg-table-available/10 hover:bg-table-available/20', badge: 'success' },
  OCCUPIED: { tile: 'border-table-occupied/40 bg-table-occupied/10 hover:bg-table-occupied/20', badge: 'error' },
  RESERVED: { tile: 'border-table-reserved/40 bg-table-reserved/10 hover:bg-table-reserved/20', badge: 'warning' },
  CLEANING: { tile: 'border-table-cleaning/40 bg-table-cleaning/10 hover:bg-table-cleaning/20', badge: 'neutral' },
  BILLING: { tile: 'border-table-billing/40 bg-table-billing/10 hover:bg-table-billing/20', badge: 'info' },
};

function qrImageUrl(data: string, size: number) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

function tableQrPayload(table: DiningTable) {
  return table.qrUrl || table.qrCode || '';
}

export function TablesPage() {
  const queryClient = useQueryClient();
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const authOrgSlug = useAuthStore((s) => s.user?.organizationSlug);
  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const orgQuery = useQuery({ queryKey: ['organizations', 'current'], queryFn: organizationsApi.current });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const outlet = outletsQuery.data?.find((o) => o.id === outletId);
  const orgSlug = orgQuery.data?.slug ?? authOrgSlug;
  const outletSlug = outlet?.slug;
  const phoneMenuQrEnabled =
    settingsQuery.data?.platformCapabilities?.phoneMenuQrEnabled === true;
  const takeawayUrl =
    phoneMenuQrEnabled && orgSlug && outletSlug
      ? `${GUEST_APP_BASE.replace(/\/$/, '')}/o/${encodeURIComponent(orgSlug)}/${encodeURIComponent(outletSlug)}`
      : null;
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [floorId, setFloorId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [newFloorName, setNewFloorName] = useState('');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [detailTable, setDetailTable] = useState<DiningTable | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCapacity, setEditCapacity] = useState('4');
  const [editFloorId, setEditFloorId] = useState('');
  const [editSectionId, setEditSectionId] = useState('');

  const {
    data: tables = [],
    isLoading,
    error: tablesError,
  } = useQuery({
    queryKey: ['tables', outletId],
    queryFn: () => tablesApi.listByOutlet(outletId!),
    enabled: !!outletId,
  });

  const {
    data: floors = [],
    isLoading: floorsLoading,
  } = useQuery({
    queryKey: ['floors', outletId],
    queryFn: () => tablesApi.listFloors(outletId!),
    enabled: !!outletId,
  });

  const selectedFloor: FloorPlanFloor | undefined = floors.find((f) => f.id === floorId);
  const filteredTables =
    floorFilter === 'all'
      ? tables
      : floorFilter === 'unassigned'
        ? tables.filter((t) => !tableFloorId(t))
        : tables.filter((t) => tableFloorId(t) === floorFilter);

  const createMutation = useMutation({
    mutationFn: tablesApi.create,
    onSuccess: () => {
      setMessage('Table created.');
      setError(null);
      setName('');
      setCapacity('4');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
      queryClient.invalidateQueries({ queryKey: ['floors', outletId] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const createFloorMutation = useMutation({
    mutationFn: (payload: { name: string }) => tablesApi.createFloor(outletId!, payload),
    onSuccess: (floor) => {
      setMessage(`Floor “${floor?.name ?? 'created'}” added with a default Dining section.`);
      setError(null);
      setNewFloorName('');
      queryClient.invalidateQueries({ queryKey: ['floors', outletId] });
      if (floor?.id) {
        setFloorId(floor.id);
        const firstSection = floor.sections[0]?.id ?? '';
        setSectionId(firstSection);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const mergeMutation = useMutation({
    mutationFn: () => tablesApi.merge(outletId!, primaryId, selectedIds),
    onSuccess: () => {
      setMessage('Tables merged onto primary.');
      setError(null);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const transferMutation = useMutation({
    mutationFn: () => tablesApi.transfer(outletId!, primaryId, transferToId),
    onSuccess: () => {
      setMessage('Session transferred.');
      setError(null);
      setSelectedIds([]);
      setTransferToId('');
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
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
      setDetailTable((prev) =>
        prev && prev.id === vars.tableId ? { ...prev, status: vars.status } : prev,
      );
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      capacity: number;
      floorId?: string;
      sectionId?: string;
    }) => tablesApi.update(outletId!, detailTable!.id, payload),
    onSuccess: (updated) => {
      setMessage('Table updated.');
      setError(null);
      setEditing(false);
      setDetailTable(updated);
      queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
      queryClient.invalidateQueries({ queryKey: ['floors', outletId] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tablesApi.remove(outletId!, detailTable!.id),
    onSuccess: () => {
      setMessage('Table deleted.');
      setError(null);
      setDetailTable(null);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
      queryClient.invalidateQueries({ queryKey: ['floors', outletId] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  function openDetail(table: DiningTable) {
    setDetailTable(table);
    setEditing(false);
    setEditName(table.name);
    setEditCapacity(String(table.capacity));
    setEditFloorId(table.section?.floor?.id ?? '');
    setEditSectionId(table.section?.id ?? '');
  }

  const editFloor = floors.find((f) => f.id === editFloorId);

  const regenerateMutation = useMutation({
    mutationFn: (tableId: string) => tablesApi.regenerateQr(outletId!, tableId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
      setMessage(`New unique QR generated for ${updated.name}. Re-print stickers with this code.`);
      setError(null);
      setDetailTable(updated);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
    onSettled: () => {
      setRegeneratingId(null);
    },
  });

  function toggleSelect(tableId: string) {
    setSelectedIds((prev) =>
      prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId],
    );
  }

  function printTableQrSheet() {
    const withQr = tables.filter((t) => tableQrPayload(t));
    if (withQr.length === 0) {
      setError('No tables have QR codes yet.');
      return;
    }
    const outletLabel = outlet?.name ?? 'Outlet';
    const cells = withQr
      .map((t) => {
        const url = tableQrPayload(t);
        return `<div class="cell"><img src="${qrImageUrl(url, 280)}" alt="${t.name}" /><div class="name">${t.name}</div><div class="cap">${t.capacity} seats</div></div>`;
      })
      .join('');
    const html = `<!doctype html><html><head><title>Table QR — ${outletLabel}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:24px;color:#111}
  h1{font-size:18px;margin:0 0 16px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
  .cell{border:1px solid #ddd;border-radius:12px;padding:12px;text-align:center;page-break-inside:avoid}
  .cell img{width:140px;height:140px}
  .name{font-weight:700;margin-top:8px}
  .cap{font-size:12px;color:#666}
  @media print{body{margin:12px}.cell{break-inside:avoid}}
</style></head><body>
<h1>${outletLabel} — dedicated table QR stickers</h1>
<div class="grid">${cells}</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      setError('Pop-up blocked — allow pop-ups to print the QR sheet.');
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  if (!outletId) {
    return (
      <PageShell title="Tables" description="Select an outlet to manage tables." />
    );
  }

  return (
    <PageShell
      title="Tables"
      description="Floor map for dining status. Waiter and QR ordering use these tables."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={printTableQrSheet} disabled={tables.length === 0}>
            Print QR sheet
          </Button>
          <Button
            onClick={() => {
              const firstFloor = floors[0];
              setFloorId(firstFloor?.id ?? '');
              setSectionId(firstFloor?.sections[0]?.id ?? '');
              setShowForm(true);
            }}
          >
            Add table
          </Button>
        </div>
      }
    >
      {error ? <p className="text-sm text-status-error">{error}</p> : null}
      {message ? <p className="text-sm text-status-success">{message}</p> : null}
      {tablesError ? (
        <p className="text-sm text-status-error">
          {tablesError instanceof Error ? tablesError.message : 'Failed to load tables'}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 text-xs text-text-muted">
        {TABLE_STATUSES.map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                status === 'AVAILABLE'
                  ? 'bg-table-available'
                  : status === 'OCCUPIED'
                    ? 'bg-table-occupied'
                    : status === 'RESERVED'
                      ? 'bg-table-reserved'
                      : status === 'BILLING'
                        ? 'bg-table-billing'
                        : 'bg-table-cleaning'
              }`}
            />
            {status.toLowerCase()}
          </span>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Floors"
          description="Name floors (Ground, First, Second…) then place tables on them. Waiter filters by the same floors."
        />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="New floor name"
              placeholder="Ground"
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            loading={createFloorMutation.isPending}
            disabled={!newFloorName.trim()}
            onClick={() => createFloorMutation.mutate({ name: newFloorName.trim() })}
          >
            Add floor
          </Button>
        </div>
        {floorsLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading floors…</p>
        ) : floors.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            No floors yet. Add Ground / First / Second so tables can be grouped for waiters.
          </p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {floors.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
              >
                <span className="font-medium text-text-primary">{f.name}</span>
                <span className="text-xs text-text-muted">
                  {f.sections.map((s) => `${s.name} (${s.tableCount})`).join(' · ') || 'No sections'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Floor map"
          description={
            isLoading
              ? 'Loading tables…'
              : `${filteredTables.length} of ${tables.length} table${tables.length === 1 ? '' : 's'} · click to manage`
          }
        />
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFloorFilter('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              floorFilter === 'all'
                ? 'bg-brand-primary text-white'
                : 'bg-bg-elevated text-text-secondary hover:bg-white/10'
            }`}
          >
            All
          </button>
          {floors.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFloorFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                floorFilter === f.id
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-elevated text-text-secondary hover:bg-white/10'
              }`}
            >
              {f.name}
            </button>
          ))}
          {tables.some((t) => !tableFloorId(t)) ? (
            <button
              type="button"
              onClick={() => setFloorFilter('unassigned')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                floorFilter === 'unassigned'
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-elevated text-text-secondary hover:bg-white/10'
              }`}
            >
              Unassigned
            </button>
          ) : null}
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-bg-elevated" />
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            {tables.length === 0
              ? 'No tables yet. Add your first table to build the floor map.'
              : 'No tables on this floor.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredTables.map((table) => {
              const style = STATUS_STYLE[table.status] ?? STATUS_STYLE.AVAILABLE;
              const selected = selectedIds.includes(table.id);
              const floorName = table.section?.floor?.name;
              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => openDetail(table)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggleSelect(table.id);
                  }}
                  className={`relative flex min-h-28 flex-col items-center justify-center rounded-2xl border p-3 text-center transition active:scale-[0.98] ${style.tile} ${
                    selected ? 'ring-2 ring-brand-primary' : ''
                  }`}
                >
                  {selected ? (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-primary" />
                  ) : null}
                  <span className="font-display text-lg font-semibold tracking-tight">{table.name}</span>
                  <span className="mt-1 text-xs text-text-secondary">
                    {table.capacity} seats
                    {floorName ? ` · ${floorName}` : ''}
                    {table.section?.name ? ` · ${table.section.name}` : ''}
                  </span>
                  <Badge variant={style.badge} className="mt-2 capitalize">
                    {table.status.toLowerCase()}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-text-muted">
          Tip: right-click a table to multi-select for merge.
        </p>
      </Card>

      {phoneMenuQrEnabled ? (
        <Card>
          <CardHeader
            title="Takeaway & walk-in QR"
            description="One QR for the whole outlet — no table assignment. Paste on counter stickers, packaging, or a menu board."
          />
          {takeawayUrl ? (
            <div className="flex flex-wrap items-start gap-5">
              <div className="shrink-0">
                <img
                  src={qrImageUrl(takeawayUrl, 200)}
                  alt="Takeaway QR"
                  width={120}
                  height={120}
                  className="rounded-xl bg-white p-2"
                />
              </div>
              <div className="min-w-0 space-y-3">
                <p className="text-sm text-text-secondary">
                  Opens the phone storefront for <strong>{outlet?.name ?? 'this outlet'}</strong> without any table
                  pre-selected. Guests can choose dine-in, takeaway, or delivery themselves.
                </p>
                <code className="block break-all rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-xs text-brand-primary">
                  {takeawayUrl}
                </code>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => window.open(qrImageUrl(takeawayUrl, 800), '_blank', 'noopener,noreferrer')}
                  >
                    Download QR (800 px)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void navigator.clipboard.writeText(takeawayUrl)}
                  >
                    Copy URL
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-4 text-sm text-text-muted">
              {outletsQuery.isLoading || orgQuery.isLoading
                ? 'Loading outlet details…'
                : 'Organization or outlet slug is missing — complete setup first.'}
            </p>
          )}
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Merge / transfer"
          description="Select tables (right-click), pick a primary, then merge sessions or transfer one session to a free table."
        />
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-text-muted">Primary</span>
            <select
              className="rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={primaryId}
              onChange={(e) => setPrimaryId(e.target.value)}
            >
              <option value="">Select…</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-text-muted">Transfer to</span>
            <select
              className="rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={transferToId}
              onChange={(e) => setTransferToId(e.target.value)}
            >
              <option value="">Select…</option>
              {tables
                .filter((t) => t.id !== primaryId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              disabled={!primaryId || selectedIds.length === 0 || mergeMutation.isPending}
              onClick={() => mergeMutation.mutate()}
            >
              Merge selected ({selectedIds.length})
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!primaryId || !transferToId || transferMutation.isPending}
              onClick={() => transferMutation.mutate()}
            >
              Transfer
            </Button>
          </div>
        </div>
      </Card>

      <Drawer
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New table"
        footer={
          <Button type="submit" form="table-create-form" loading={createMutation.isPending}>
            Create table
          </Button>
        }
      >
        <form
          id="table-create-form"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setMessage(null);
            createMutation.mutate({
              outletId,
              name,
              capacity: Number(capacity) || 4,
              ...(floorId ? { floorId } : {}),
              ...(sectionId ? { sectionId } : {}),
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
          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Floor</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
              value={floorId}
              onChange={(e) => {
                const next = e.target.value;
                setFloorId(next);
                const floor = floors.find((f) => f.id === next);
                setSectionId(floor?.sections[0]?.id ?? '');
              }}
            >
              <option value="">Unassigned</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          {selectedFloor && selectedFloor.sections.length > 0 ? (
            <label className="block text-sm">
              <span className="mb-1 block text-text-secondary">Section</span>
              <select
                className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
              >
                {selectedFloor.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </form>
      </Drawer>

      <Drawer
        open={Boolean(detailTable)}
        onClose={() => {
          setDetailTable(null);
          setEditing(false);
        }}
        title={detailTable?.name ?? 'Table'}
        description={
          detailTable
            ? `${detailTable.capacity} seats${
                detailTable.section?.floor?.name ? ` · ${detailTable.section.floor.name}` : ''
              }${detailTable.section?.name ? ` · ${detailTable.section.name}` : ''}`
            : undefined
        }
      >
        {detailTable ? (
          <div className="space-y-4">
            {editing ? (
              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateMutation.mutate({
                    name: editName,
                    capacity: Number(editCapacity) || 4,
                    ...(editFloorId ? { floorId: editFloorId } : {}),
                    ...(editSectionId ? { sectionId: editSectionId } : {}),
                  });
                }}
              >
                <Input
                  label="Table name"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <Input
                  label="Capacity"
                  type="number"
                  min={1}
                  required
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)}
                />
                <label className="block text-sm">
                  <span className="mb-1 block text-text-secondary">Floor</span>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
                    value={editFloorId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setEditFloorId(next);
                      const floor = floors.find((f) => f.id === next);
                      setEditSectionId(floor?.sections[0]?.id ?? '');
                    }}
                  >
                    <option value="">Unassigned</option>
                    {floors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                {editFloor && editFloor.sections.length > 0 ? (
                  <label className="block text-sm">
                    <span className="mb-1 block text-text-secondary">Section</span>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
                      value={editSectionId}
                      onChange={(e) => setEditSectionId(e.target.value)}
                    >
                      {editFloor.sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={updateMutation.isPending}>
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setEditName(detailTable.name);
                      setEditCapacity(String(detailTable.capacity));
                      setEditFloorId(detailTable.section?.floor?.id ?? '');
                      setEditSectionId(detailTable.section?.id ?? '');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                  Edit table
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  loading={deleteMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete table “${detailTable.name}”? This cannot be undone.`,
                      )
                    ) {
                      deleteMutation.mutate();
                    }
                  }}
                >
                  Delete table
                </Button>
              </div>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-text-secondary">Status</span>
              <select
                value={detailTable.status}
                onChange={(e) =>
                  statusMutation.mutate({ tableId: detailTable.id, status: e.target.value })
                }
                className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm capitalize outline-none focus:border-brand-primary"
              >
                {TABLE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            {tableQrPayload(detailTable) ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <img
                    src={qrImageUrl(tableQrPayload(detailTable), 150)}
                    alt={`QR for ${detailTable.name}`}
                    width={96}
                    height={96}
                    className="rounded-lg bg-white p-1"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-text-primary">Dedicated table QR</p>
                    <p className="text-xs text-text-muted">
                      Guests scanning this sticker join this table&apos;s order session.
                    </p>
                  </div>
                </div>
                {detailTable.qrUrl ? (
                  <code className="block break-all rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-xs text-brand-primary">
                    {detailTable.qrUrl}
                  </code>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      window.open(
                        qrImageUrl(tableQrPayload(detailTable), 800),
                        '_blank',
                        'noopener,noreferrer',
                      )
                    }
                  >
                    Download QR
                  </Button>
                  {detailTable.qrUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        void navigator.clipboard.writeText(detailTable.qrUrl!);
                        setMessage('Table QR URL copied.');
                      }}
                    >
                      Copy URL
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    loading={regeneratingId === detailTable.id}
                    onClick={() => {
                      setRegeneratingId(detailTable.id);
                      regenerateMutation.mutate(detailTable.id);
                    }}
                  >
                    Regenerate QR
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-text-muted">No QR yet — generate one for a permanent sticker.</p>
                <Button
                  type="button"
                  variant="secondary"
                  loading={regeneratingId === detailTable.id}
                  onClick={() => {
                    setRegeneratingId(detailTable.id);
                    regenerateMutation.mutate(detailTable.id);
                  }}
                >
                  Generate QR
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                toggleSelect(detailTable.id);
              }}
            >
              {selectedIds.includes(detailTable.id) ? 'Deselect for merge' : 'Select for merge'}
            </Button>
          </div>
        ) : null}
      </Drawer>
    </PageShell>
  );
}
