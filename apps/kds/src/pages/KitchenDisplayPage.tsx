import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { KotCard } from '@/components/KotCard';
import { StationFilter } from '@/components/StationFilter';
import { Button, Select } from '@/components/ui/Form';
import { useKitchenSocket } from '@/hooks/useKitchenSocket';
import { kitchenApi, outletsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useKdsStore } from '@/stores/kds';

export function KitchenDisplayPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const setSelectedOutlet = useAuthStore((s) => s.setSelectedOutlet);
  const selectedStationId = useKdsStore((s) => s.selectedStationId);

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: outletsApi.list,
  });

  const { data: displayData, isLoading, isError, refetch } = useQuery({
    queryKey: ['kitchen-display', outletId, selectedStationId],
    queryFn: () => kitchenApi.getDisplay(outletId!, selectedStationId ?? undefined),
    enabled: Boolean(outletId),
    refetchInterval: 30_000,
  });

  useKitchenSocket(outletId);

  const kots = useMemo(() => {
    if (!displayData) return [];
    if (selectedStationId) {
      const station = displayData.stations.find((s) => s.station.id === selectedStationId);
      return station?.kots ?? [];
    }
    return displayData.allKots;
  }, [displayData, selectedStationId]);

  const sortedKots = useMemo(
    () =>
      [...kots].sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }),
    [kots],
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-bg-secondary px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Kitchen Display</h1>
          <p className="text-sm text-text-secondary">
            {user ? `${user.firstName} ${user.lastName}` : 'Staff'}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Outlet"
            value={outletId ?? ''}
            onChange={(e) => setSelectedOutlet(e.target.value || null)}
            options={[
              { value: '', label: 'Select outlet' },
              ...outlets.filter((o) => o.isActive).map((o) => ({
                value: o.id,
                label: o.name,
              })),
            ]}
            className="min-w-[180px]"
          />
          {displayData ? <StationFilter displayData={displayData} /> : null}
          <Button variant="ghost" onClick={() => void refetch()}>
            Refresh
          </Button>
          <Button variant="secondary" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6">
        {!outletId ? (
          <div className="flex h-64 items-center justify-center text-text-secondary">
            Select an outlet to view kitchen tickets.
          </div>
        ) : isLoading ? (
          <div className="flex h-64 items-center justify-center text-text-secondary">
            Loading tickets…
          </div>
        ) : isError ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-status-error">
            <p>Failed to load kitchen display.</p>
            <Button variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : sortedKots.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-text-secondary">
            No active tickets — waiting for orders.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {sortedKots.map((kot) => (
              <KotCard key={kot.id} kot={kot} outletId={outletId} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
