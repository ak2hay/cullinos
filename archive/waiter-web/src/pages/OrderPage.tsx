import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QuickAddBar } from '@/components/MenuQuickAdd';
import { Button } from '@cullinos/ui';
import { menuApi, ordersApi, posApi, tablesApi, type OrderItem } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

type StagingLine = {
  key: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export function OrderPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const [staging, setStaging] = useState<StagingLine[]>([]);

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

  const menuById = useMemo(() => {
    const map = new Map<string, { name: string; price: number }>();
    for (const item of menu?.items ?? []) {
      map.set(item.id, { name: item.name, price: item.price });
    }
    return map;
  }, [menu?.items]);

  const { data: activeSession, refetch: refetchSession } = useQuery({
    queryKey: ['table-session', tableId],
    queryFn: () => tablesApi.getActiveSession(outletId!, tableId!),
    enabled: Boolean(outletId && tableId),
  });

  const closeSessionMutation = useMutation({
    mutationFn: () =>
      tablesApi.closeSession(outletId!, tableId!, activeSession!.id),
    onSuccess: () => {
      invalidate();
      void refetchSession();
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['table-orders-detail', tableId] });
    void queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
    void refetchOrders();
    void refetchOrderDetail();
  };

  const addToOrderMutation = useMutation({
    mutationFn: async (items: OrderItem[]) => {
      if (activeOrder) {
        return ordersApi.addItems(activeOrder.id, items);
      }
      return posApi.quickOrder({
        outletId: outletId!,
        tableId: tableId!,
        items,
        autoConfirm: false,
      });
    },
    onSuccess: () => {
      setStaging([]);
      invalidate();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => ordersApi.confirm(activeOrder!.id),
    onSuccess: invalidate,
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      ordersApi.updateItem(activeOrder!.id, itemId, quantity),
    onSuccess: invalidate,
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => ordersApi.removeItem(activeOrder!.id, itemId),
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

  function handleQuickAdd(items: OrderItem[]) {
    for (const item of items) {
      const meta = menuById.get(item.menuItemId);
      setStaging((prev) => {
        const existing = prev.find((l) => l.menuItemId === item.menuItemId);
        if (existing) {
          return prev.map((l) =>
            l.menuItemId === item.menuItemId
              ? { ...l, quantity: l.quantity + (item.quantity || 1) }
              : l,
          );
        }
        return [
          ...prev,
          {
            key: `${item.menuItemId}-${Date.now()}`,
            menuItemId: item.menuItemId,
            name: meta?.name ?? 'Item',
            unitPrice: meta?.price ?? 0,
            quantity: item.quantity || 1,
          },
        ];
      });
    }
  }

  function bumpStaging(key: string, delta: number) {
    setStaging((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  const stagingPayload: OrderItem[] = staging.map((l) => ({
    menuItemId: l.menuItemId,
    quantity: l.quantity,
  }));

  const stagingTotal = staging.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const isDraft = activeOrder?.status === 'DRAFT';
  const isBusy =
    addToOrderMutation.isPending ||
    updateItemMutation.isPending ||
    removeItemMutation.isPending;

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
              {activeSession ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={closeSessionMutation.isPending}
                  onClick={() => closeSessionMutation.mutate()}
                >
                  End session
                </Button>
              ) : null}
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

      <div className="flex-1 space-y-4 p-4">
        {staging.length > 0 ? (
          <div className="rounded-xl border border-brand-primary/30 bg-bg-card p-4">
            <h2 className="mb-3 text-sm font-medium text-brand-primary">New items (not sent)</h2>
            <ul className="space-y-2">
              {staging.map((line) => (
                <li key={line.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{line.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-8 w-8 rounded-lg border border-white/10"
                      onClick={() => bumpStaging(line.key, -1)}
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-mono">{line.quantity}</span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-lg border border-white/10"
                      onClick={() => bumpStaging(line.key, 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="text-xs text-status-error"
                      onClick={() => setStaging((prev) => prev.filter((l) => l.key !== line.key))}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-sm">
              <span>Staging total</span>
              <span>₹{(stagingTotal / 100).toFixed(0)}</span>
            </div>
            <Button
              className="mt-3 w-full"
              loading={addToOrderMutation.isPending}
              onClick={() => addToOrderMutation.mutate(stagingPayload)}
            >
              Add to order
            </Button>
          </div>
        ) : null}

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
                  <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1">
                      {item.quantity}× {item.name}
                    </span>
                    <span className="text-text-secondary">
                      ₹{((item.unitPrice * item.quantity) / 100).toFixed(0)}
                    </span>
                    {isDraft ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isBusy || item.quantity <= 1}
                          className="h-7 w-7 rounded border border-white/10 text-xs disabled:opacity-40"
                          onClick={() =>
                            updateItemMutation.mutate({
                              itemId: item.id,
                              quantity: item.quantity - 1,
                            })
                          }
                        >
                          −
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          className="h-7 w-7 rounded border border-white/10 text-xs disabled:opacity-40"
                          onClick={() =>
                            updateItemMutation.mutate({
                              itemId: item.id,
                              quantity: item.quantity + 1,
                            })
                          }
                        >
                          +
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          className="text-xs text-status-error disabled:opacity-40"
                          onClick={() => removeItemMutation.mutate(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
                {(orderDetail?.items ?? []).length === 0 ? (
                  <li className="text-sm text-text-muted">No items on order yet</li>
                ) : null}
              </ul>

              <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-sm font-medium">
                <span>Subtotal</span>
                <span className="text-brand-primary">
                  ₹{((orderDetail?.subtotal ?? activeOrder.subtotal) / 100).toFixed(0)}
                </span>
              </div>
            </div>

            {isDraft ? (
              <Button
                className="w-full"
                loading={confirmMutation.isPending}
                disabled={(orderDetail?.items ?? []).length === 0}
                onClick={() => confirmMutation.mutate()}
              >
                Confirm order
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/20 p-8 text-center">
            <p className="text-text-secondary">No active order for this table.</p>
            <p className="mt-1 text-sm text-text-muted">
              Quick-add items below, then tap Add to order.
            </p>
          </div>
        )}
      </div>

      {menu ? (
        <QuickAddBar
          items={menu.items}
          loading={false}
          onQuickAdd={handleQuickAdd}
        />
      ) : null}
    </div>
  );
}
