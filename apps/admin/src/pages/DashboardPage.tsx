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
    enabled: Boolean(outletId),
  });

  const summary = data?.summary;

  const kpis = [
    {
      label: "Today's revenue",
      value: summary ? formatMoney(summary.totalRevenue) : '—',
      hint: data?.date ?? 'Daily totals',
    },
    {
      label: 'Orders completed',
      value: summary ? String(summary.totalOrders) : '—',
      hint: 'Completed today',
    },
    {
      label: 'Open orders',
      value: summary ? String(summary.openOrders) : '—',
      hint: 'In progress or held',
    },
    {
      label: 'Average order value',
      value: summary ? formatMoney(summary.averageOrderValue) : '—',
      hint: 'Per completed order',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          Good {getGreeting()}, {user?.firstName}
        </h1>
        <p className="mt-1 text-text-secondary">
          Daily performance overview for your restaurant.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load analytics'}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-white/5 bg-bg-card p-5"
          >
            <p className="text-sm text-text-secondary">{kpi.label}</p>
            {isLoading ? (
              <div className="mt-2 h-9 w-24 animate-pulse rounded bg-bg-elevated" />
            ) : (
              <p className="mt-2 font-mono text-3xl font-semibold text-brand-primary">
                {kpi.value}
              </p>
            )}
            <p className="mt-2 text-xs text-text-muted">{kpi.hint}</p>
          </div>
        ))}
      </div>

      {data?.paymentBreakdown.length ? (
        <div className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="text-lg font-semibold">Payment breakdown</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.paymentBreakdown.map((payment) => (
              <div
                key={payment.method}
                className="rounded-lg border border-white/5 bg-bg-elevated px-4 py-3"
              >
                <p className="text-sm text-text-secondary">{payment.method}</p>
                <p className="mt-1 font-mono text-lg font-semibold">
                  {formatMoney(payment.amount)}
                </p>
                <p className="text-xs text-text-muted">{payment.count} transactions</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
