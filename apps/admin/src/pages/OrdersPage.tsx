import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderStatus } from '@cullinos/shared';
import { Button, Tabs } from '@cullinos/ui';
import { ordersApi, type Order } from '@/lib/api';
import { formatDate, formatMoney, formatMoneyExact } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';

const statusColors: Record<string, string> = {
  DRAFT: 'text-text-muted',
  CONFIRMED: 'text-status-info',
  PREPARING: 'text-status-warning',
  READY: 'text-status-success',
  HELD: 'text-brand-accent',
  COMPLETED: 'text-status-success',
  CANCELLED: 'text-status-error',
  VOIDED: 'text-status-error',
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

type OrdersTab = 'current' | 'recent';

const CURRENT_STATUSES: OrderStatus[] = ['DRAFT', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'];
const RECENT_STATUSES = ['COMPLETED', 'CANCELLED', 'VOIDED'] as unknown as OrderStatus[];
const PAGE_SIZE = 50;
const REFRESH_MS = 15_000;

function todayInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local-day bounds (browser timezone — IST for Indian outlets) as ISO strings. */
function dayBounds(day: string): { from: string; to: string } {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function OrdersPage() {
  const { t } = useTranslation();
  const statusLabel = (status: string) => t(`orderStatus.${status}`, { defaultValue: status });
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<OrdersTab>('current');
  const [day, setDay] = useState(todayInputValue);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [scheduledOnly, setScheduledOnly] = useState(false);

  const filters = useMemo(
    () =>
      tab === 'current'
        ? { status: CURRENT_STATUSES }
        : { status: RECENT_STATUSES, ...dayBounds(day) },
    [tab, day],
  );

  const ordersQuery = useInfiniteQuery({
    queryKey: ['orders', outletId, tab, tab === 'recent' ? day : null],
    queryFn: ({ pageParam }) =>
      ordersApi.list({
        outletId: outletId ?? undefined,
        ...filters,
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta?.hasMore ? last.meta.page + 1 : undefined),
    enabled: Boolean(outletId),
    refetchInterval: tab === 'current' ? REFRESH_MS : false,
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

  const allOrders = ordersQuery.data?.pages.flatMap((p) => p.data) ?? [];
  const total = ordersQuery.data?.pages[0]?.meta?.total ?? allOrders.length;
  const orders = scheduledOnly
    ? allOrders.filter((o) => Boolean(o.scheduledPickupAt))
    : allOrders;
  const detail = detailQuery.data;

  const emptyMessage = scheduledOnly
    ? t('orders.emptyScheduled')
    : tab === 'current'
      ? t('orders.emptyCurrent')
      : t('orders.emptyRecent');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('orders.title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('orders.subtitle')}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-primary"
            checked={scheduledOnly}
            onChange={(e) => setScheduledOnly(e.target.checked)}
          />
          {t('orders.scheduledOnly')}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          items={[
            { id: 'current', label: t('orders.tabCurrent') },
            { id: 'recent', label: t('orders.tabRecent') },
          ]}
          value={tab}
          onChange={(id) => {
            setTab(id);
            setSelectedId(null);
          }}
        />
        {tab === 'recent' ? (
          <input
            type="date"
            value={day}
            max={todayInputValue()}
            onChange={(e) => setDay(e.target.value || todayInputValue())}
            className="h-9 rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
            aria-label={t('orders.day')}
          />
        ) : null}
        {outletId && !ordersQuery.isLoading ? (
          <span className="text-xs text-text-muted">
            {t('orders.count', { count: total })}
            {ordersQuery.isFetching ? ` · ${t('orders.refreshing')}` : ''}
          </span>
        ) : null}
      </div>

      {ordersQuery.error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {ordersQuery.error instanceof Error ? ordersQuery.error.message : t('orders.loadFailed')}
        </div>
      ) : null}

      {!outletId ? (
        <div className="rounded-xl border border-white/5 bg-bg-card px-4 py-8 text-center text-sm text-text-muted">
          {t('orders.selectOutlet')}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/5 bg-bg-elevated text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('orders.colOrder')}</th>
                    <th className="px-4 py-3 font-medium">{t('orders.colStatus')}</th>
                    <th className="px-4 py-3 font-medium">{t('orders.colSource')}</th>
                    <th className="px-4 py-3 font-medium">{t('orders.colTotal')}</th>
                    <th className="px-4 py-3 font-medium">{t('orders.colCreated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersQuery.isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                        {t('orders.loadingOrders')}
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                        {emptyMessage}
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
                            {order.tableName ? (
                              <span className="font-sans text-xs text-text-muted">
                                {order.tableName}
                              </span>
                            ) : null}
                            {order.scheduledPickupAt ? (
                              <span className="rounded bg-brand-primary/15 px-1.5 py-0.5 text-[10px] font-sans font-medium uppercase tracking-wide text-brand-primary">
                                {t('orders.scheduled')}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-medium ${statusColors[order.status] ?? ''}`}>
                          {statusLabel(order.status)}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {order.source ?? order.type ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-mono">{formatMoney(order.totalAmount)}</td>
                        <td className="px-4 py-3 text-text-secondary">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {ordersQuery.hasNextPage ? (
              <Button
                type="button"
                variant="secondary"
                loading={ordersQuery.isFetchingNextPage}
                onClick={() => ordersQuery.fetchNextPage()}
              >
                {t('common.loadMore')}
              </Button>
            ) : null}
          </div>

          <aside className="rounded-xl border border-white/5 bg-bg-card p-5">
            {!selectedId ? (
              <p className="text-sm text-text-muted">{t('orders.selectOrder')}</p>
            ) : detailQuery.isLoading ? (
              <p className="text-sm text-text-muted">{t('common.loading')}</p>
            ) : detailQuery.error ? (
              <p className="text-sm text-status-error">
                {detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : t('orders.loadOrderFailed')}
              </p>
            ) : detail ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-mono text-lg font-semibold">#{detail.orderNumber}</h2>
                    <p className={`text-sm font-medium ${statusColors[detail.status] ?? ''}`}>
                      {statusLabel(detail.status)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-text-muted hover:text-text-primary"
                    onClick={() => setSelectedId(null)}
                  >
                    {t('common.close')}
                  </button>
                </div>

                <dl className="space-y-1 text-sm text-text-secondary">
                  {detail.customerName ? (
                    <div className="flex justify-between gap-2">
                      <dt>{t('orders.customer')}</dt>
                      <dd>{detail.customerName}</dd>
                    </div>
                  ) : null}
                  {detail.scheduledPickupAt ? (
                    <div className="flex justify-between gap-2">
                      <dt>{t('orders.scheduledPickup')}</dt>
                      <dd className="text-brand-primary">
                        {formatDate(detail.scheduledPickupAt)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt>{t('orders.created')}</dt>
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
                          {formatMoneyExact(item.unitPrice * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <BillBreakdown order={detail} />

                {statusError ? <p className="text-sm text-status-error">{statusError}</p> : null}

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                    {t('orders.updateStatus')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_ACTIONS.filter((s) => s !== detail.status).map((status) => (
                      <Button
                        key={status}
                        type="button"
                        variant="secondary"
                        className="h-9 px-3 text-xs"
                        loading={statusMutation.isPending}
                        onClick={() => {
                          if (
                            status === 'CANCELLED' &&
                            !window.confirm(
                              t('orders.confirmCancel', { number: detail.orderNumber }),
                            )
                          ) {
                            return;
                          }
                          statusMutation.mutate({ id: detail.id, status });
                        }}
                      >
                        {statusLabel(status)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}

function BillBreakdown({ order }: { order: Order }) {
  const { t } = useTranslation();
  const taxLines = order.taxLines ?? [];
  const row = (label: string, paise: number, className = '') => (
    <div className={`flex justify-between gap-2 ${className}`}>
      <dt>{label}</dt>
      <dd className="font-mono">{formatMoneyExact(paise)}</dd>
    </div>
  );
  return (
    <dl className="space-y-1 border-t border-white/5 pt-3 text-sm text-text-secondary">
      {row(t('bill.subtotal'), order.subtotal)}
      {taxLines.length > 0
        ? taxLines.map((line, i) => (
            <div key={`${line.taxName}-${line.rate}-${i}`}>
              {row(`${line.taxName} ${line.rate}%`, line.amount)}
            </div>
          ))
        : (order.taxTotal ?? 0) > 0
          ? row(t('bill.tax'), order.taxTotal ?? 0)
          : row(t('bill.tax'), 0, 'text-text-muted')}
      {(order.discountTotal ?? 0) > 0 ? row(t('bill.discount'), -(order.discountTotal ?? 0)) : null}
      {(order.tipAmount ?? 0) > 0 ? row(t('bill.tip'), order.tipAmount ?? 0) : null}
      {row(
        t('bill.total'),
        order.totalAmount,
        'border-t border-white/5 pt-1 font-semibold text-text-primary',
      )}
    </dl>
  );
}
