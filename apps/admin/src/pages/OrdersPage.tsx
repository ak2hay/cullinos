import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';

const statusColors: Record<string, string> = {
  DRAFT: 'text-text-muted',
  CONFIRMED: 'text-status-info',
  PREPARING: 'text-status-warning',
  READY: 'text-status-success',
  HELD: 'text-brand-accent',
  COMPLETED: 'text-status-success',
  CANCELLED: 'text-status-error',
};

export function OrdersPage() {
  const outletId = useAuthStore((s) => s.selectedOutletId);

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', outletId],
    queryFn: () => ordersApi.list({ outletId: outletId ?? undefined, limit: 50 }),
    enabled: Boolean(outletId),
  });

  const orders = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Recent orders for the selected outlet.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load orders'}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/5 bg-bg-elevated text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Order #</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Loading orders…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-mono">{order.orderNumber}</td>
                  <td className={`px-4 py-3 font-medium ${statusColors[order.status] ?? ''}`}>
                    {order.status}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{order.source}</td>
                  <td className="px-4 py-3 font-mono">{formatMoney(order.totalAmount)}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(order.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
