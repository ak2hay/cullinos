import { useQuery } from '@tanstack/react-query';
import { BarChart } from '@/components/charts/BarChart';
import { analyticsApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';

export function ComparisonPage() {
  const brandId = useAuthStore((s) => s.selectedBrandId);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['analytics', 'outlet-comparison', brandId],
    queryFn: () => analyticsApi.outletComparison({ brandId: brandId ?? undefined }),
    retry: false,
  });

  const revenueBars = data.map((row) => ({
    label: row.outletName,
    value: row.revenue,
    displayValue: formatMoney(row.revenue),
  }));

  const orderBars = data.map((row) => ({
    label: row.outletName,
    value: row.orders,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Outlet comparison</h1>
        <p className="mt-1 text-text-secondary">
          Compare revenue and order volume across outlets in the selected brand.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          Outlet comparison API unavailable — showing placeholder when endpoints are not yet deployed.
        </div>
      ) : null}

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-bg-card" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-white/5 bg-bg-card p-6">
            <h2 className="mb-4 font-medium">Revenue by outlet</h2>
            <BarChart items={revenueBars} valueLabel="Revenue (INR)" />
          </section>
          <section className="rounded-xl border border-white/5 bg-bg-card p-6">
            <h2 className="mb-4 font-medium">Orders by outlet</h2>
            <BarChart items={orderBars} valueLabel="Order count" colorClass="bg-brand-accent" />
          </section>
        </div>
      )}
    </div>
  );
}
