import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const outletId = useAuthStore((s) => s.selectedOutletId);

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'daily', outletId],
    queryFn: () => analyticsApi.daily({ outletId: outletId ?? undefined }),
  });

  const summary = data?.summary;

  const kpis = [
    { label: 'Consolidated revenue', value: summary ? formatMoney(summary.totalRevenue) : '—' },
    { label: 'Total orders', value: summary ? String(summary.totalOrders) : '—' },
    { label: 'Open orders', value: summary ? String(summary.openOrders) : '—' },
    { label: 'Avg order value', value: summary ? formatMoney(summary.averageOrderValue) : '—' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Enterprise overview</h1>
        <p className="mt-1 text-text-secondary">
          Welcome back, {user?.firstName}. Consolidated performance across your network.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load analytics'}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-white/5 bg-bg-card p-5">
            <p className="text-sm text-text-muted">{kpi.label}</p>
            <p className="mt-2 text-2xl font-semibold">
              {isLoading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-bg-elevated" /> : kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">Payment mix</h2>
          <ul className="mt-4 space-y-2">
            {(data?.paymentBreakdown ?? []).map((row) => (
              <li key={row.method} className="flex justify-between text-sm">
                <span className="capitalize text-text-secondary">{row.method}</span>
                <span>{formatMoney(row.amount)} · {row.count} orders</span>
              </li>
            ))}
            {!isLoading && (data?.paymentBreakdown?.length ?? 0) === 0 ? (
              <li className="text-sm text-text-muted">No payment data yet</li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">Hourly breakdown</h2>
          <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
            {(data?.hourlyBreakdown ?? []).map((row) => (
              <li key={row.hour} className="flex justify-between text-sm">
                <span className="text-text-secondary">{String(row.hour).padStart(2, '0')}:00</span>
                <span>{row.orders} orders · {formatMoney(row.revenue)}</span>
              </li>
            ))}
            {!isLoading && (data?.hourlyBreakdown?.length ?? 0) === 0 ? (
              <li className="text-sm text-text-muted">No hourly data yet</li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
