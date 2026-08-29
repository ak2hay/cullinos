import { useQuery } from '@tanstack/react-query';
import { analyticsApi, ordersApi } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';

export function ReportsPage() {
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const brandId = useAuthStore((s) => s.selectedBrandId);

  const { data: daily, isLoading: dailyLoading } = useQuery({
    queryKey: ['analytics', 'daily', outletId],
    queryFn: () => analyticsApi.daily({ outletId: outletId ?? undefined }),
  });

  const { data: comparison, isLoading: comparisonLoading } = useQuery({
    queryKey: ['analytics', 'outlet-comparison', brandId],
    queryFn: () => analyticsApi.outletComparison({ brandId: brandId ?? undefined }),
    retry: false,
  });

  const { data: orders } = useQuery({
    queryKey: ['orders', 'recent', outletId],
    queryFn: () => ordersApi.list({ outletId: outletId ?? undefined, limit: 10 }),
  });

  const totalNetworkRevenue =
    comparison?.reduce((sum, row) => sum + row.revenue, 0) ?? daily?.summary.totalRevenue ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Consolidated reports</h1>
        <p className="mt-1 text-text-secondary">
          Network-wide performance summary for {daily?.date ?? 'today'}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-bg-card p-5">
          <p className="text-sm text-text-muted">Network revenue</p>
          <p className="mt-2 text-2xl font-semibold">
            {dailyLoading ? '…' : formatMoney(totalNetworkRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-bg-card p-5">
          <p className="text-sm text-text-muted">Outlets reporting</p>
          <p className="mt-2 text-2xl font-semibold">
            {comparisonLoading ? '…' : (comparison?.length ?? 1)}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-bg-card p-5">
          <p className="text-sm text-text-muted">Cancelled orders</p>
          <p className="mt-2 text-2xl font-semibold">
            {dailyLoading ? '…' : (daily?.summary.cancelledOrders ?? 0)}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-white/5 bg-bg-card p-6">
        <h2 className="font-medium">Outlet revenue summary</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-text-muted">
                <th className="pb-3 pr-4 font-medium">Outlet</th>
                <th className="pb-3 pr-4 font-medium">Revenue</th>
                <th className="pb-3 pr-4 font-medium">Orders</th>
                <th className="pb-3 font-medium">AOV</th>
              </tr>
            </thead>
            <tbody>
              {(comparison ?? []).map((row) => (
                <tr key={row.outletId} className="border-b border-white/5">
                  <td className="py-3 pr-4">{row.outletName}</td>
                  <td className="py-3 pr-4">{formatMoney(row.revenue)}</td>
                  <td className="py-3 pr-4">{row.orders}</td>
                  <td className="py-3">{formatMoney(row.averageOrderValue)}</td>
                </tr>
              ))}
              {!comparisonLoading && (comparison?.length ?? 0) === 0 && daily ? (
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4">Selected scope</td>
                  <td className="py-3 pr-4">{formatMoney(daily.summary.totalRevenue)}</td>
                  <td className="py-3 pr-4">{daily.summary.totalOrders}</td>
                  <td className="py-3">{formatMoney(daily.summary.averageOrderValue)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-6">
        <h2 className="font-medium">Recent orders</h2>
        <ul className="mt-4 divide-y divide-white/5">
          {(orders?.data ?? []).map((order) => (
            <li key={order.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-mono font-medium">{order.orderNumber}</p>
                <p className="text-text-muted">{formatDate(order.createdAt)}</p>
              </div>
              <div className="text-right">
                <p>{formatMoney(order.totalAmount)}</p>
                <p className="capitalize text-text-muted">{order.status.toLowerCase()}</p>
              </div>
            </li>
          ))}
          {(orders?.data?.length ?? 0) === 0 ? (
            <li className="py-4 text-sm text-text-muted">No recent orders</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
