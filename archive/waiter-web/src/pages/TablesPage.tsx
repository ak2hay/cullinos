import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NewOrderModal } from '@/components/NewOrderModal';
import { QrCodeModal } from '@/components/QrCodeModal';
import { TableCard } from '@/components/TableCard';
import { Button } from '@cullinos/ui';
import { ordersApi, outletsApi, tablesApi, type Table, type TableSession } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function TablesPage() {
  const navigate = useNavigate();
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const setSelectedOutlet = useAuthStore((s) => s.setSelectedOutlet);

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeSession, setActiveSession] = useState<TableSession | null>(null);

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: outletsApi.list,
  });

  const { data: tables = [], isLoading, refetch } = useQuery({
    queryKey: ['tables', outletId],
    queryFn: () => tablesApi.list(outletId!),
    enabled: Boolean(outletId),
  });

  const { data: serviceRequests = [], refetch: refetchCalls } = useQuery({
    queryKey: ['service-requests', outletId],
    queryFn: () => tablesApi.listServiceRequests(outletId!),
    enabled: Boolean(outletId),
    refetchInterval: 20_000,
  });

  const orderQueries = useQueries({
    queries: tables.map((table) => ({
      queryKey: ['table-orders', table.id],
      queryFn: () =>
        ordersApi.list({
          outletId: outletId!,
          tableId: table.id,
          status: 'CONFIRMED',
        }),
      enabled: Boolean(outletId),
      staleTime: 15_000,
    })),
  });

  const orderCountByTable = useMemo(() => {
    const map = new Map<string, number>();
    tables.forEach((table, i) => {
      const result = orderQueries[i]?.data;
      map.set(table.id, result?.data?.length ?? 0);
    });
    return map;
  }, [tables, orderQueries]);

  const callByTable = useMemo(() => {
    const map = new Map<string, (typeof serviceRequests)[number]>();
    for (const req of serviceRequests) {
      if (!map.has(req.tableId)) {
        map.set(req.tableId, req);
      }
    }
    return map;
  }, [serviceRequests]);

  const assignMutation = useMutation({
    mutationFn: (tableId: string) =>
      tablesApi.updateStatus(outletId!, tableId, 'OCCUPIED'),
    onSuccess: () => void refetch(),
  });

  const startSessionMutation = useMutation({
    mutationFn: (tableId: string) => tablesApi.startSession(outletId!, tableId),
    onSuccess: (session) => {
      setActiveSession(session);
      void refetch();
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => tablesApi.acknowledgeServiceRequest(outletId!, id),
    onSuccess: () => void refetchCalls(),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => tablesApi.resolveServiceRequest(outletId!, id),
    onSuccess: () => void refetchCalls(),
  });

  function handleTableSelect(table: Table) {
    setSelectedTable(table);
  }

  function handleWaiterOrder() {
    if (!selectedTable) return;
    navigate(`/order/${selectedTable.id}`);
    setSelectedTable(null);
  }

  function handleQrOrder() {
    if (!selectedTable) return;
    startSessionMutation.mutate(selectedTable.id);
    setSelectedTable(null);
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <label htmlFor="outlet" className="mb-1 block text-xs font-medium text-text-secondary">
          Outlet
        </label>
        <select
          id="outlet"
          value={outletId ?? ''}
          onChange={(e) => setSelectedOutlet(e.target.value || null)}
          className="h-10 w-full rounded-lg border border-white/10 bg-bg-card px-3 text-sm outline-none focus:border-brand-primary"
        >
          <option value="">Select outlet</option>
          {outlets.filter((o) => o.isActive).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {serviceRequests.length > 0 ? (
        <div className="mb-4 space-y-2 rounded-xl border border-status-warning/40 bg-status-warning/10 p-3">
          <p className="text-sm font-semibold text-status-warning">
            {serviceRequests.length} table call{serviceRequests.length > 1 ? 's' : ''}
          </p>
          {serviceRequests.map((req) => (
            <div
              key={req.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bg-card/60 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{req.tableName ?? 'Table'}</p>
                <p className="text-xs text-text-secondary">
                  {req.status === 'acknowledged' ? 'Acknowledged' : 'Waiting'} ·{' '}
                  {new Date(req.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                {req.status === 'open' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={acknowledgeMutation.isPending}
                    onClick={() => acknowledgeMutation.mutate(req.id)}
                  >
                    Acknowledge
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  loading={resolveMutation.isPending}
                  onClick={() => resolveMutation.mutate(req.id)}
                >
                  Done
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!outletId ? (
        <p className="py-12 text-center text-text-secondary">Select an outlet to view tables.</p>
      ) : isLoading ? (
        <p className="py-12 text-center text-text-secondary">Loading tables…</p>
      ) : tables.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-text-secondary">No tables configured for this outlet.</p>
          <p className="mt-2 text-xs text-text-muted">
            Tables are created by the restaurant owner in Admin → Settings → Outlets.<br />
            For QA testing, switch to <strong>Main Outlet</strong> which has pre-configured tables.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tables.map((table) => {
            const call = callByTable.get(table.id);
            return (
              <div key={table.id} className="flex flex-col gap-2">
                <TableCard
                  table={table}
                  activeOrderCount={orderCountByTable.get(table.id) ?? 0}
                  calling={Boolean(call)}
                  callStatus={call?.status ?? null}
                  onSelect={() => handleTableSelect(table)}
                />
                {table.status === 'AVAILABLE' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={assignMutation.isPending}
                    onClick={() => assignMutation.mutate(table.id)}
                  >
                    Assign table
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {selectedTable ? (
        <NewOrderModal
          tableName={selectedTable.name}
          loading={startSessionMutation.isPending}
          onQrOrder={handleQrOrder}
          onWaiterOrder={handleWaiterOrder}
          onClose={() => setSelectedTable(null)}
        />
      ) : null}

      {activeSession?.qrUrl ? (
        <QrCodeModal
          tableName={activeSession.tableName}
          qrUrl={activeSession.qrUrl}
          sessionToken={activeSession.sessionToken}
          onViewOrder={() => {
            navigate(`/order/${activeSession.tableId}`);
            setActiveSession(null);
          }}
          onClose={() => setActiveSession(null)}
        />
      ) : null}
    </div>
  );
}
