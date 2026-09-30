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
import { downloadQr, printHtml, qrDataUrl, useQrDataUrl } from '@/lib/qr';
import { escapeHtml } from '@/features/pos/printHelper';
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

function QrImage({
  data,
  size,
  ...rest
}: { data: string; size: number } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const src = useQrDataUrl(data, size);
  if (!src) {
    return <div style={{ width: rest.width, height: rest.height }} className={rest.className} />;
  }
  return <img src={src} {...rest} />;
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
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editingFloorName, setEditingFloorName] = useState('');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<{
    mode: 'merge' | 'transfer';
    first: DiningTable | null;
  } | null>(null);
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

  const renameFloorMutation = useMutation({
    mutationFn: (payload: { floorId: string; name: string }) =>
      tablesApi.updateFloor(outletId!, payload.floorId, { name: payload.name }),
    onSuccess: (floor) => {
      setMessage(`Floor renamed to “${floor?.name ?? ''}”.`);
      setError(null);
      setEditingFloorId(null);
      queryClient.invalidateQueries({ queryKey: ['floors', outletId] });
      queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const deleteFloorMutation = useMutation({
    mutationFn: (floor: FloorPlanFloor) => tablesApi.deleteFloor(outletId!, floor.id),
    onSuccess: (_data, floor) => {
      setMessage(`Floor “${floor.name}” deleted.`);
      setError(null);
      if (floorFilter === floor.id) setFloorFilter('all');
      if (floorId === floor.id) {
        setFloorId('');
        setSectionId('');
      }
      queryClient.invalidateQueries({ queryKey: ['floors', outletId] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  function floorTableCount(floor: FloorPlanFloor) {
    return floor.sections.reduce((sum, s) => sum + s.tableCount, 0);
  }

  function confirmDeleteFloor(floor: FloorPlanFloor) {
    const count = floorTableCount(floor);
    if (count > 0) {
      setError(
        `“${floor.name}” still has ${count} table${count === 1 ? '' : 's'}. Move or delete its tables first.`,
      );
      setMessage(null);
      return;
    }
    if (window.confirm(`Delete floor “${floor.name}”? This cannot be undone.`)) {
      deleteFloorMutation.mutate(floor);
    }
  }

  const tableActionMutation = useMutation({
    mutationFn: async (vars: { mode: 'merge' | 'transfer'; first: DiningTable; second: DiningTable }) => {
      if (vars.mode === 'merge') {
        await tablesApi.merge(outletId!, vars.first.id, [vars.second.id]);
      } else {
        await tablesApi.transfer(outletId!, vars.first.id, vars.second.id);
      }
    },
    onSuccess: (_data, vars) => {
      setMessage(
        vars.mode === 'merge'
          ? `${vars.second.name} merged with ${vars.first.name}.`
          : `Moved ${vars.first.name} to ${vars.second.name}.`,
      );
      setError(null);
      setActionMode(null);
      queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const unmergeMutation = useMutation({
    mutationFn: (table: DiningTable) => tablesApi.unmerge(outletId!, table.id),
    onSuccess: (_data, table) => {
      setMessage(`${table.name} unmerged and set to available.`);
      setError(null);
      setDetailTable(null);
      queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  function isTableEligible(table: DiningTable): boolean {
    if (!actionMode) return true;
    const merged = !!table.mergedIntoTableId;
    const status = table.status.toUpperCase();
    const { mode, first } = actionMode;
    if (!first) {
      if (mode === 'merge') return !merged;
      return !merged && (status === 'OCCUPIED' || status === 'BILLING');
    }
    if (table.id === first.id || merged) return false;
    if (mode === 'merge') return status === 'AVAILABLE' || status === 'OCCUPIED';
    return status === 'AVAILABLE';
  }

  function handleTileClick(table: DiningTable) {
    if (!actionMode) {
      const primary = table.mergedIntoTableId
        ? tables.find((t) => t.id === table.mergedIntoTableId)
        : null;
      openDetail(primary ?? table);
      return;
    }
    const { mode, first } = actionMode;
    if (first?.id === table.id) {
      setActionMode({ mode, first: null });
      return;
    }
    if (!isTableEligible(table) || tableActionMutation.isPending) return;
    if (!first) {
      setActionMode({ mode, first: table });
      return;
    }
    const question =
      mode === 'merge'
        ? `Merge ${table.name} into ${first.name}? ${table.name} will show as merged with ${first.name} until ${first.name} is freed.`
        : `Move ${first.name} to ${table.name}?`;
    if (window.confirm(question)) {
      tableActionMutation.mutate({ mode, first, second: table });
    }
  }

  const actionStep = actionMode
    ? actionMode.mode === 'merge'
      ? actionMode.first
        ? `Step 2 of 2: Click the table to merge into ${actionMode.first.name}`
        : 'Step 1 of 2: Click the main table'
      : actionMode.first
        ? `Step 2 of 2: Click a free table to move ${actionMode.first.name} to`
        : 'Step 1 of 2: Click the table to move'
    : null;

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

  async function printTableQrSheet() {
    const withQr = tables.filter((t) => tableQrPayload(t));
    if (withQr.length === 0) {
      setError('No tables have QR codes yet.');
      return;
    }
    const outletLabel = escapeHtml(outlet?.name ?? 'Outlet');
    const images = await Promise.all(withQr.map((t) => qrDataUrl(tableQrPayload(t), 280)));
    const cells = withQr
      .map((t, i) => {
        const name = escapeHtml(t.name);
        return `<div class="cell"><img src="${images[i]}" alt="${name}" /><div class="name">${name}</div><div class="cap">${escapeHtml(t.capacity)} seats</div></div>`;
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
</body></html>`;
    try {
      printHtml(html);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not print the QR sheet.');
    }
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
          <Button type="button" variant="secondary" onClick={() => void printTableQrSheet()} disabled={tables.length === 0}>
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
            {floors.map((f) => {
              const isEditing = editingFloorId === f.id;
              const trimmed = editingFloorName.trim();
              return (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-bg-elevated px-3 py-2"
                >
                  {isEditing ? (
                    <form
                      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!trimmed || trimmed === f.name) {
                          setEditingFloorId(null);
                          return;
                        }
                        renameFloorMutation.mutate({ floorId: f.id, name: trimmed });
                      }}
                    >
                      <input
                        autoFocus
                        aria-label={`Rename floor ${f.name}`}
                        className="h-9 min-w-[10rem] flex-1 rounded-lg border border-line bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-brand-primary"
                        value={editingFloorName}
                        maxLength={80}
                        onChange={(e) => setEditingFloorName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingFloorId(null);
                        }}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        loading={renameFloorMutation.isPending}
                        disabled={!trimmed}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingFloorId(null)}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <span className="font-medium text-text-primary">{f.name}</span>
                        <span className="ml-2 text-xs text-text-muted">
                          {f.sections.map((s) => `${s.name} (${s.tableCount})`).join(' · ') ||
                            'No sections'}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingFloorId(f.id);
                            setEditingFloorName(f.name);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-status-error"
                          loading={
                            deleteFloorMutation.isPending && deleteFloorMutation.variables?.id === f.id
                          }
                          onClick={() => confirmDeleteFloor(f)}
                        >
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
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
          actions={
            <>
              <Button
                type="button"
                variant={actionMode?.mode === 'merge' ? 'primary' : 'secondary'}
                disabled={tables.length < 2}
                onClick={() => setActionMode({ mode: 'merge', first: null })}
              >
                Merge table
              </Button>
              <Button
                type="button"
                variant={actionMode?.mode === 'transfer' ? 'primary' : 'secondary'}
                disabled={tables.length < 2}
                onClick={() => setActionMode({ mode: 'transfer', first: null })}
              >
                Transfer table
              </Button>
            </>
          }
        />
        {actionStep ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-brand-primary/50 bg-brand-primary/10 px-4 py-2.5">
            <p className="text-sm font-semibold text-text-primary">{actionStep}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={tableActionMutation.isPending}
              onClick={() => setActionMode(null)}
            >
              Cancel
            </Button>
          </div>
        ) : null}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFloorFilter('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              floorFilter === 'all'
                ? 'bg-brand-primary text-on-brand'
                : 'bg-bg-elevated text-text-secondary hover:bg-hover-strong'
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
                  ? 'bg-brand-primary text-on-brand'
                  : 'bg-bg-elevated text-text-secondary hover:bg-hover-strong'
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
                  ? 'bg-brand-primary text-on-brand'
                  : 'bg-bg-elevated text-text-secondary hover:bg-hover-strong'
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
              const floorName = table.section?.floor?.name;
              const isMerged = !!table.mergedIntoTableId;
              const mergedNames = table.mergedTableNames ?? [];
              const isPicked = actionMode?.first?.id === table.id;
              const eligible = isTableEligible(table);
              const dimmed = !!actionMode && !isPicked && !eligible;
              const invite = !!actionMode?.first && eligible;
              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => handleTileClick(table)}
                  aria-disabled={dimmed}
                  className={`relative flex min-h-28 flex-col items-center justify-center rounded-2xl border p-3 text-center transition active:scale-[0.98] ${
                    isMerged
                      ? 'border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20'
                      : style.tile
                  } ${isPicked ? 'opacity-40 ring-2 ring-brand-primary' : ''} ${
                    dimmed ? 'cursor-not-allowed opacity-30' : ''
                  } ${invite ? 'ring-2 ring-brand-primary/70' : ''}`}
                >
                  {isPicked ? (
                    <span className="absolute left-2 top-2 rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-on-brand">
                      {actionMode?.mode === 'merge' ? 'Primary' : 'From'}
                    </span>
                  ) : null}
                  <span className="font-display text-lg font-semibold tracking-tight">{table.name}</span>
                  <span className="mt-1 text-xs text-text-secondary">
                    {table.capacity} seats
                    {floorName ? ` · ${floorName}` : ''}
                    {table.section?.name ? ` · ${table.section.name}` : ''}
                  </span>
                  {isMerged ? (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        <path d="M8.5 11.5a3 3 0 0 0 4.24 0l2.5-2.5a3 3 0 1 0-4.24-4.24l-.9.9 1.06 1.06.9-.9a1.5 1.5 0 1 1 2.12 2.12l-2.5 2.5a1.5 1.5 0 0 1-2.12 0l-1.06 1.06Zm3-3a3 3 0 0 0-4.24 0l-2.5 2.5a3 3 0 1 0 4.24 4.24l.9-.9-1.06-1.06-.9.9a1.5 1.5 0 1 1-2.12-2.12l2.5-2.5a1.5 1.5 0 0 1 2.12 0l1.06-1.06Z" />
                      </svg>
                      Merged with {table.mergedIntoTableName ?? 'another table'}
                    </span>
                  ) : (
                    <Badge variant={style.badge} className="mt-2 capitalize">
                      {table.status.toLowerCase()}
                      {mergedNames.length > 0 ? ` · +${mergedNames.join(', ')}` : ''}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}
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
                <QrImage
                  data={takeawayUrl}
                  size={200}
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
                <code className="block break-all rounded-lg border border-line bg-bg-elevated px-3 py-2 text-xs text-brand-primary">
                  {takeawayUrl}
                </code>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void downloadQr(takeawayUrl, 800, 'takeaway-qr')}
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
              className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
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
                className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
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
                    className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
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
                      className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
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
                className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm capitalize outline-none focus:border-brand-primary"
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
                  <QrImage
                    data={tableQrPayload(detailTable)}
                    size={150}
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
                  <code className="block break-all rounded-lg border border-line bg-bg-elevated px-3 py-2 text-xs text-brand-primary">
                    {detailTable.qrUrl}
                  </code>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      void downloadQr(
                        tableQrPayload(detailTable),
                        800,
                        `table-${detailTable.name.replace(/[^\w-]+/g, '_')}-qr`,
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
            {detailTable.mergedIntoTableId ? (
              <div className="space-y-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                <p className="text-sm font-medium text-text-primary">
                  Merged with {detailTable.mergedIntoTableName ?? 'another table'}
                </p>
                <p className="text-xs text-text-muted">
                  Orders and the bill for this table are on {detailTable.mergedIntoTableName ?? 'the main table'}.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  loading={unmergeMutation.isPending}
                  onClick={() => unmergeMutation.mutate(detailTable)}
                >
                  Unmerge
                </Button>
              </div>
            ) : null}
            {(detailTable.mergedTableIds ?? []).length > 0 ? (
              <div className="space-y-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                <p className="text-sm font-medium text-text-primary">Merged tables</p>
                <p className="text-xs text-text-muted">
                  These tables are released automatically when {detailTable.name} is freed.
                </p>
                <ul className="space-y-1">
                  {(detailTable.mergedTableIds ?? []).map((id, idx) => {
                    const merged = tables.find((t) => t.id === id);
                    const label = detailTable.mergedTableNames?.[idx] ?? merged?.name ?? id;
                    return (
                      <li key={id} className="flex items-center justify-between gap-2 text-sm">
                        <span>{label}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          loading={unmergeMutation.isPending && unmergeMutation.variables?.id === id}
                          onClick={() =>
                            unmergeMutation.mutate(
                              merged ?? ({ ...detailTable, id, name: label } as DiningTable),
                            )
                          }
                        >
                          Unmerge
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </PageShell>
  );
}
