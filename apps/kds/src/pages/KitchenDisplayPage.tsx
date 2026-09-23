import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KotCard } from '@/components/KotCard';
import { StationFilter } from '@/components/StationFilter';
import { Button, Select } from '@cullinos/ui';
import { useKitchenSocket } from '@/hooks/useKitchenSocket';
import { apiRequest, kitchenApi, outletsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useKdsStore } from '@/stores/kds';

const HEARTBEAT_INTERVAL_MS = 60_000;

/** Stamp lastSeenAt on the server every HEARTBEAT_INTERVAL_MS (authenticated). */
function useDisplayHeartbeat(outletId: string | null) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!outletId) return;

    function ping() {
      void apiRequest(
        '/devices/display-heartbeat',
        { method: 'POST', body: JSON.stringify({ outletId, mode: 'kds' }) },
        true,
      ).catch(() => {
        // swallow — heartbeat is best-effort
      });
    }

    ping();
    intervalRef.current = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [outletId]);
}

/** Toggle browser fullscreen on the document root. */
function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggle() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }

  return { isFullscreen, toggle };
}

export function KitchenDisplayPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const storeOutletId = useAuthStore((s) => s.selectedOutletId);
  const setSelectedOutlet = useAuthStore((s) => s.setSelectedOutlet);
  const selectedStationId = useKdsStore((s) => s.selectedStationId);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlOutletId = searchParams.get('outletId')?.trim() || null;
  const outletId = urlOutletId || storeOutletId;

  useEffect(() => {
    if (urlOutletId && urlOutletId !== storeOutletId) {
      setSelectedOutlet(urlOutletId);
    }
  }, [urlOutletId, storeOutletId, setSelectedOutlet]);

  const outletsQuery = useQuery({
    queryKey: ['outlets'],
    queryFn: outletsApi.list,
  });
  const outlets = outletsQuery.data ?? [];

  const { data: displayData, isLoading, isError, refetch } = useQuery({
    queryKey: ['kitchen-display', outletId, selectedStationId],
    queryFn: () => kitchenApi.getDisplay(outletId!, selectedStationId ?? undefined),
    enabled: Boolean(outletId),
    refetchInterval: 30_000,
  });

  const socketStatus = useKitchenSocket(outletId);
  useDisplayHeartbeat(outletId);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const outletOptions = useMemo(() => {
    const active = outlets.filter((o) => o.isActive);
    const options = [
      { value: '', label: 'Select outlet' },
      ...active.map((o) => ({ value: o.id, label: o.name })),
    ];
    if (outletId && !options.some((o) => o.value === outletId)) {
      const fallbackName =
        outlets.find((o) => o.id === outletId)?.name ?? `Outlet ${outletId.slice(-6)}`;
      options.push({ value: outletId, label: fallbackName });
    }
    return options;
  }, [outlets, outletId]);

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

  function onOutletChange(nextId: string | null) {
    setSelectedOutlet(nextId);
    const next = new URLSearchParams(searchParams);
    if (nextId) next.set('outletId', nextId);
    else next.delete('outletId');
    setSearchParams(next, { replace: true });
  }

  function reLogin() {
    logout();
    const q = outletId ? `?outletId=${encodeURIComponent(outletId)}` : '';
    navigate(`/login${q}`);
  }

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
            onChange={(e) => onOutletChange(e.target.value || null)}
            options={outletOptions}
            className="min-w-[180px]"
          />
          {displayData ? <StationFilter displayData={displayData} /> : null}
          <Button variant="ghost" onClick={() => void refetch()}>
            Refresh
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              /* compress icon */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
            ) : (
              /* expand icon */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7V3h4"/><path d="M21 7V3h-4"/><path d="M3 17v4h4"/><path d="M21 17v4h-4"/></svg>
            )}
          </Button>
          <Button variant="secondary" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>

      {outletsQuery.isError ? (
        <div className="border-b border-status-warning/30 bg-status-warning/10 px-6 py-2 text-sm text-status-warning">
          Could not load outlets list. Using the outlet from the URL. If actions fail, sign in again.
        </div>
      ) : null}

      {outletId && socketStatus === 'auth_failed' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-status-error/30 bg-status-error/10 px-6 py-2 text-sm text-status-error">
          <span>Session expired — sign in again to update tickets and receive live updates.</span>
          <Button variant="secondary" onClick={reLogin}>
            Sign in again
          </Button>
        </div>
      ) : null}

      {outletId && (socketStatus === 'error' || socketStatus === 'disconnected') ? (
        <div className="border-b border-status-warning/30 bg-status-warning/10 px-6 py-2 text-sm text-status-warning">
          {socketStatus === 'error'
            ? 'Live updates unavailable — connection failed. Showing polled data.'
            : 'Reconnecting to live updates…'}
        </div>
      ) : null}

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
