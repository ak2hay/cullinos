import { useQuery } from '@tanstack/react-query';
import { superAdminApi } from '@/lib/api';

export function HealthPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['super-admin', 'health'],
    queryFn: superAdminApi.health,
    refetchInterval: 30_000,
  });

  const metrics = data?.metrics;

  const cards = [
    { label: 'Total organizations', value: metrics?.totalOrganizations },
    { label: 'Active organizations', value: metrics?.activeOrganizations },
    { label: 'Orders today', value: metrics?.ordersToday },
    { label: 'Pending sync events', value: metrics?.pendingSyncEvents },
    { label: 'Failed notifications', value: metrics?.failedNotifications },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">System health</h1>
          <p className="mt-1 text-text-secondary">
            Platform status and operational metrics.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load health data'}
        </div>
      ) : null}

      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-bg-card p-5">
        <span
          className={`h-3 w-3 rounded-full ${
            data?.status === 'ok' ? 'bg-status-success' : 'bg-status-warning'
          }`}
        />
        <div>
          <p className="font-medium capitalize">{data?.status ?? (isLoading ? 'Loading…' : 'Unknown')}</p>
          <p className="text-sm text-text-muted">
            Database: {data?.database ?? '—'} · Last check:{' '}
            {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '—'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/5 bg-bg-card p-5">
            <p className="text-sm text-text-muted">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">
              {isLoading ? '…' : (card.value ?? 0)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
