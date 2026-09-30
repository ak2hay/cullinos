import { useQuery } from '@tanstack/react-query';
import { isErpNavPathAllowed, type OrderStatus } from '@cullinos/shared';
import { inventoryApi, ordersApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

/** Same set the analytics `daily()` summary counts as open. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = ['DRAFT', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'];

const LIVE_ORDERS_LIMIT = 5;

/** Latest open orders for the selected outlet; `total` powers the nav badge. */
export function useOpenOrders() {
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const permissions = useAuthStore((s) => s.permissions);
  const allowed = isErpNavPathAllowed(permissions, '/orders');

  const query = useQuery({
    queryKey: ['orders', 'open', outletId],
    queryFn: () =>
      ordersApi.list({
        outletId: outletId ?? undefined,
        status: OPEN_ORDER_STATUSES,
        limit: LIVE_ORDERS_LIMIT,
      }),
    enabled: allowed,
    refetchInterval: 20_000,
    retry: false,
  });

  return {
    orders: query.data?.data ?? [],
    total: query.data?.meta.total ?? 0,
    isLoading: allowed && query.isLoading,
    allowed,
  };
}

export function useLowStock() {
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const permissions = useAuthStore((s) => s.permissions);
  const allowed = isErpNavPathAllowed(permissions, '/inventory');

  const query = useQuery({
    queryKey: ['inventory', 'low-stock', outletId],
    queryFn: () => inventoryApi.listLowStock(outletId),
    enabled: allowed,
    retry: false,
  });

  return { items: query.data ?? [], allowed };
}
