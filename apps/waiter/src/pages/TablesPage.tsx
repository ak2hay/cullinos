import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableCard } from '@/components/TableCard';
import { Button } from '@/components/ui/Form';
import { ordersApi, outletsApi, tablesApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function TablesPage() {
  const navigate = useNavigate();
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const setSelectedOutlet = useAuthStore((s) => s.setSelectedOutlet);

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: outletsApi.list,
  });

  const { data: tables = [], isLoading, refetch } = useQuery({
    queryKey: ['tables', outletId],
    queryFn: () => tablesApi.list(outletId!),
    enabled: Boolean(outletId),
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

  const assignMutation = useMutation({
    mutationFn: (tableId: string) =>
      tablesApi.updateStatus(outletId!, tableId, 'OCCUPIED'),
    onSuccess: () => void refetch(),
  });

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

      {!outletId ? (
        <p className="py-12 text-center text-text-secondary">Select an outlet to view tables.</p>
      ) : isLoading ? (
        <p className="py-12 text-center text-text-secondary">Loading tables…</p>
      ) : tables.length === 0 ? (
        <p className="py-12 text-center text-text-secondary">No tables configured.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tables.map((table) => (
            <div key={table.id} className="flex flex-col gap-2">
              <TableCard
                table={table}
                activeOrderCount={orderCountByTable.get(table.id) ?? 0}
                onSelect={() => navigate(`/tables/${table.id}`)}
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
          ))}
        </div>
      )}
    </div>
  );
}
