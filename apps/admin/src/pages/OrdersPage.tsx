import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { OrderStatus } from '@cullinos/shared';
import { Button } from '@cullinos/ui';
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
  SERVED: 'text-status-success',
};

const STATUS_ACTIONS: OrderStatus[] = [
  'CONFIRMED',
  'PREPARING',
  'READY',
  'SERVED',
  'COMPLETED',
  'CANCELLED',
];

export function OrdersPage() {
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [scheduledOnly, setScheduledOnly] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', outletId],
    queryFn: () => ordersApi.list({ outletId: outletId ?? undefined, limit: 50 }),
    enabled: Boolean(outletId),
  });

  const detailQuery = useQuery({
    queryKey: ['orders', 'detail', selectedId],
    queryFn: () => ordersApi.get(selectedId!),
    enabled: Boolean(selectedId),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      ordersApi.updateStatus(id, status),
    onSuccess: () => {
      setStatusError(null);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: Error) => setStatusError(err.message),
  });

  const allOrders = data?.data ?? [];
  const orders = scheduledOnly
    ? allOrders.filter((o) => Boolean(o.scheduledPickupAt))
    : allOrders;
  const detail = detailQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Recent orders for the selected outlet. Click a row for details and status changes.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-primary"
            checked={scheduledOnly}
            onChange={(e) => setScheduledOnly(e.target.checked)}
          />
          Scheduled / pre-orders only
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load orders'}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
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
                    {scheduledOnly ? 'No scheduled orders found.' : 'No orders found.'}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    className={`cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/5 ${
                      selectedId === order.id ? 'bg-white/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {order.orderNumber}
                        {order.scheduledPickupAt ? (
                          <span className="rounded bg-brand-primary/15 px-1.5 py-0.5 text-[10px] font-sans font-medium uppercase tracking-wide text-brand-primary">
                            Scheduled
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${statusColors[order.status] ?? ''}`}>
                      {order.status}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {order.source ?? order.type ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono">{formatMoney(order.totalAmount)}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(order.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <aside className="rounded-xl border border-white/5 bg-bg-card p-5">
          {!selectedId ? (
            <p className="text-sm text-text-muted">Select an order to view details.</p>
          ) : detailQuery.isLoading ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : detailQuery.error ? (
            <p className="text-sm text-status-error">
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : 'Failed to load order'}
            </p>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold font-mono">#{detail.orderNumber}</h2>
                  <p className={`text-sm font-medium ${statusColors[detail.status] ?? ''}`}>
                    {detail.status}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs text-text-muted hover:text-text-primary"
                  onClick={() => setSelectedId(null)}
                >
                  Close
                </button>
              </div>

              <dl className="space-y-1 text-sm text-text-secondary">
                <div className="flex justify-between gap-2">
                  <dt>Total</dt>
                  <dd className="font-mono text-text-primary">
                    {formatMoney(detail.totalAmount)}
                  </dd>
                </div>
                {detail.customerName ? (
                  <div className="flex justify-between gap-2">
                    <dt>Customer</dt>
                    <dd>{detail.customerName}</dd>
                  </div>
                ) : null}
                {detail.scheduledPickupAt ? (
                  <div className="flex justify-between gap-2">
                    <dt>Scheduled pickup</dt>
                    <dd className="text-brand-primary">{formatDate(detail.scheduledPickupAt)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <dt>Created</dt>
                  <dd>{formatDate(detail.createdAt)}</dd>
                </div>
              </dl>

              {(detail.items ?? []).length > 0 ? (
                <ul className="space-y-1 border-t border-white/5 pt-3 text-sm">
                  {detail.items!.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2 text-text-secondary">
                      <span>
                        {item.quantity}× {item.name}
                      </span>
                      <span className="font-mono">
                        {formatMoney(item.unitPrice * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {statusError ? (
                <p className="text-sm text-status-error">{statusError}</p>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                  Update status
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ACTIONS.filter((s) => s !== detail.status).map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant="secondary"
                      className="h-9 px-3 text-xs"
                      loading={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: detail.id, status })}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

