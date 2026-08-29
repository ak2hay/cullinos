import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { QuickAddBar } from '@/components/MenuQuickAdd';
import { Button } from '@/components/ui/Form';
import { menuApi, ordersApi, posApi, tablesApi, type OrderItem } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function OrderPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const outletId = useAuthStore((s) => s.selectedOutletId);

  const { data: table } = useQuery({
    queryKey: ['table', tableId],
    queryFn: async () => {
      const tables = await tablesApi.list(outletId!);
      return tables.find((t) => t.id === tableId);
    },
    enabled: Boolean(outletId && tableId),
  });

  const { data: ordersResult, refetch: refetchOrders } = useQuery({
    queryKey: ['table-orders-detail', tableId],
    queryFn: () =>
      ordersApi.list({
        outletId: outletId!,
        tableId: tableId!,
      }),
    enabled: Boolean(outletId && tableId),
  });

  const activeOrder = ordersResult?.data?.find(
    (o) => !['COMPLETED', 'CANCELLED'].includes(o.status),
  );

  const { data: orderDetail, refetch: refetchOrderDetail } = useQuery({
    queryKey: ['order', activeOrder?.id],
    queryFn: () => ordersApi.get(activeOrder!.id),
    enabled: Boolean(activeOrder?.id),
  });

  const { data: menu } = useQuery({
    queryKey: ['menu', outletId],
    queryFn: () => menuApi.getOutletMenu(outletId!),
    enabled: Boolean(outletId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['table-orders-detail', tableId] });
    void queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
    void refetchOrders();
    void refetchOrderDetail();
  };

  const createOrderMutation = useMutation({
    mutationFn: (items: OrderItem[]) =>
      ordersApi.create({
        outletId: outletId!,
        source: 'WAITER',
        tableId: tableId!,
        items,
      }),
    onSuccess: invalidate,
  });

  const addItemsMutation = useMutation({
    mutationFn: (items: OrderItem[]) => ordersApi.addItems(activeOrder!.id, items),
    onSuccess: invalidate,
  });

  const confirmMutation = useMutation({
    mutationFn: () => ordersApi.confirm(activeOrder!.id),
    onSuccess: invalidate,
  });

  const quickOrderMutation = useMutation({
    mutationFn: (items: OrderItem[]) =>
      posApi.quickOrder({
        outletId: outletId!,
        tableId: tableId!,
        items,
        autoConfirm: true,
      }),
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      tablesApi.updateStatus(outletId!, tableId!, status),
    onSuccess: invalidate,
  });

  const assignMutation = useMutation({
    mutationFn: () => tablesApi.updateStatus(outletId!, tableId!, 'OCCUPIED'),
    onSuccess: invalidate,
  });

  async function handleQuickAdd(items: OrderItem[]) {
    if (activeOrder) {
      await addItemsMutation.mutateAsync(items);
    } else {
      await quickOrderMutation.mutateAsync(items);
    }
  }

  const isBusy =
    createOrderMutation.isPending ||
    addItemsMutation.isPending ||
    quickOrderMutation.isPending;

  if (!outletId || !tableId) {
    return (
      <div className="p-4 text-center text-text-secondary">
        Missing outlet or table.
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-white/10 p-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-2 text-sm text-brand-primary"
        >
          ← Back to tables
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{table?.name ?? 'Table'}</h1>
            <p className="text-sm text-text-secondary">
              {table?.status ?? '—'} · {table?.capacity ?? 0} seats
            </p>
          </div>
          {table?.status === 'AVAILABLE' ? (
            <Button
              variant="secondary"
              size="sm"
              loading={assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              Assign table
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(['BILLING', 'CLEANING', 'AVAILABLE'] as const).map((status) => (
                <Button
                  key={status}
                  variant="secondary"
                  size="sm"
                  loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate(status)}
                >
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-4">
        {activeOrder ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-brand-primary">#{activeOrder.orderNumber}</span>
                <span className="rounded-full bg-status-preparing/20 px-2 py-0.5 text-xs font-medium text-status-preparing">
                  {activeOrder.status}
                </span>
              </div>

              <ul className="space-y-2">
                {(orderDetail?.items ?? []).map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      {item.quantity}× {item.name}
                    </span>
                    <span className="text-text-secondary">
                      ₹{((item.unitPrice * item.quantity) / 100).toFixed(0)}
                    </span>
                  </li>
                ))}
                {(orderDetail?.items ?? []).length === 0 ? (
                  <li className="text-sm text-text-muted">No items yet</li>
                ) : null}
              </ul>

              <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-sm font-medium">
                <span>Subtotal</span>
                <span className="text-brand-primary">
                  ₹{((orderDetail?.subtotal ?? activeOrder.subtotal) / 100).toFixed(0)}
                </span>
              </div>
            </div>

            {activeOrder.status === 'DRAFT' ? (
              <Button
                className="w-full"
                loading={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
              >
                Confirm order
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/20 p-8 text-center">
            <p className="text-text-secondary">No active order for this table.</p>
            <p className="mt-1 text-sm text-text-muted">Use quick add below to start an order.</p>
          </div>
        )}
      </div>

      {menu ? (
        <QuickAddBar
          items={menu.items}
          loading={isBusy}
          onQuickAdd={handleQuickAdd}
        />
      ) : null}
    </div>
  );
}
