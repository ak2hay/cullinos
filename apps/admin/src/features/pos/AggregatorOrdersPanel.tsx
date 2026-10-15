import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { urbanPiperApi, type AggregatorOrder } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { printWithProfile } from './printHelper';

const MUTE_KEY = 'cullinos.portal-pos.aggregatorMuted';
const PREP_TIMES = [10, 15, 20, 30, 45, 60];
const REJECT_REASONS = ['Item out of stock', 'Kitchen too busy', 'Store closing soon', 'Other'];

const PLATFORM_STYLE: Record<string, { label: string; className: string }> = {
  swiggy: { label: 'Swiggy', className: 'bg-[#FC8019]/15 text-[#FC8019] border-[#FC8019]/40' },
  zomato: { label: 'Zomato', className: 'bg-[#E23744]/15 text-[#E23744] border-[#E23744]/40' },
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'New',
  confirmed: 'Accepted',
  preparing: 'Preparing',
  ready: 'Food ready',
  completed: 'Handed over',
  cancelled: 'Cancelled',
};

function playChime() {
  try {
    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [0, 0.25, 0.5].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = i === 1 ? 1046 : 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.22);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* audio is best-effort */
  }
}

function countdown(acceptBy: string | null, now: number) {
  if (!acceptBy) return null;
  const ms = new Date(acceptBy).getTime() - now;
  if (ms <= 0) return { text: 'Overdue', urgent: true };
  const s = Math.ceil(ms / 1000);
  return { text: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, urgent: s <= 60 };
}

interface AggregatorOrdersPanelProps {
  outletId: string;
  onStatus: (message: string) => void;
}

export function AggregatorOrdersPanel({ outletId, onStatus }: AggregatorOrdersPanelProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1');
  const [now, setNow] = useState(() => Date.now());
  const [prepById, setPrepById] = useState<Record<string, number>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const seenPending = useRef<Set<string>>(new Set());

  const ordersQuery = useQuery({
    queryKey: ['urbanpiper', 'orders', outletId],
    queryFn: () => urbanPiperApi.listOrders(outletId),
    refetchInterval: 10_000,
    retry: false,
  });
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const pending = orders.filter((o) => o.status === 'draft');
  const active = orders.filter((o) => ['confirmed', 'preparing', 'ready'].includes(o.status));

  useEffect(() => {
    if (!pending.length) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending.length]);

  useEffect(() => {
    const fresh = pending.filter((o) => !seenPending.current.has(o.id));
    for (const o of pending) seenPending.current.add(o.id);
    if (fresh.length) {
      setOpen(true);
      const p = PLATFORM_STYLE[fresh[0].aggregator?.platform ?? '']?.label ?? 'Online';
      onStatus(`New ${p} order #${fresh[0].aggregator?.channelOrderId ?? fresh[0].orderNumber}`);
    }
    if (pending.length && !muted) playChime();
    // Re-chime on every poll while anything is still waiting for acceptance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersQuery.dataUpdatedAt]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['urbanpiper', 'orders', outletId] });

  const action = useMutation({
    mutationFn: async (input: { kind: 'accept' | 'reject' | 'ready' | 'dispatch' | 'retry'; order: AggregatorOrder; prep?: number; reason?: string }) => {
      switch (input.kind) {
        case 'accept':
          return urbanPiperApi.accept(input.order.id, input.prep);
        case 'reject':
          return urbanPiperApi.reject(input.order.id, input.reason ?? 'Rejected by restaurant');
        case 'ready':
          return urbanPiperApi.markReady(input.order.id);
        case 'dispatch':
          return urbanPiperApi.dispatch(input.order.id);
        default:
          return urbanPiperApi.retrySync(input.order.id);
      }
    },
    onSuccess: (order, input) => {
      setRejectingId(null);
      refresh();
      const ref = `#${order.aggregator?.channelOrderId ?? order.orderNumber}`;
      if (input.kind === 'accept') {
        onStatus(`Accepted ${ref}`);
        void printWithProfile(
          'kot',
          outletId,
          {
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            notes: order.notes,
            items: order.items.map((i) => ({
              name: i.modifiers.length ? `${i.name} (${i.modifiers.join(', ')})` : i.name,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              notes: i.notes,
            })),
            total: order.total,
          },
          { orderId: order.id },
        ).catch(() => undefined);
      } else if (input.kind === 'reject') onStatus(`Rejected ${ref}`);
      else if (input.kind === 'ready') onStatus(`${ref} marked food ready`);
      else if (input.kind === 'dispatch') onStatus(`${ref} handed over`);
      else onStatus(`Re-synced ${ref}`);
    },
    onError: (err) => {
      refresh();
      onStatus(err instanceof Error ? err.message : 'Action failed');
    },
  });

  if (ordersQuery.isError || (!orders.length && !open)) return null;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  };

  const busyId = action.isPending ? action.variables?.order.id : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative h-9 rounded-lg border px-3 text-sm font-medium transition ${
          pending.length
            ? 'animate-pulse border-status-warning bg-status-warning/15 text-status-warning'
            : 'border-line bg-bg-elevated hover:border-brand-primary/40'
        }`}
        title="Swiggy / Zomato orders"
      >
        Online
        {pending.length + active.length > 0 ? (
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
              pending.length ? 'bg-status-warning text-bg-primary' : 'bg-brand-primary text-on-brand'
            }`}
          >
            {pending.length || active.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Online orders"
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-line bg-bg-secondary shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
            <div>
              <p className="font-semibold">Online orders</p>
              <p className="text-xs text-text-muted">
                {pending.length} new · {active.length} in progress
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="rounded-md border border-line px-2 py-1 text-xs text-text-secondary"
              >
                {muted ? 'Sound off' : 'Sound on'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-text-muted hover:text-text-primary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {orders.length === 0 ? (
              <p className="py-10 text-center text-sm text-text-muted">No Swiggy or Zomato orders right now.</p>
            ) : null}
            {orders.map((order) => {
              const agg = order.aggregator;
              const style = PLATFORM_STYLE[agg?.platform ?? ''] ?? {
                label: 'Online',
                className: 'bg-bg-elevated text-text-secondary border-line',
              };
              const timer = order.status === 'draft' ? countdown(agg?.acceptBy ?? null, now) : null;
              const prep = prepById[order.id] ?? 20;
              const busy = busyId === order.id;
              const done = order.status === 'completed' || order.status === 'cancelled';
              return (
                <article
                  key={order.id}
                  className={`rounded-xl border bg-bg-card p-3 ${
                    order.status === 'draft' ? 'border-status-warning/60' : 'border-line-subtle'
                  } ${done ? 'opacity-60' : ''}`}
                >
                  <header className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${style.className}`}>
                          {style.label}
                        </span>
                        <span className="truncate font-mono text-sm">
                          #{agg?.channelOrderId ?? order.orderNumber}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">
                        POS {order.orderNumber} · {order.customerName ?? 'Guest'} ·{' '}
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold">{STATUS_LABEL[order.status] ?? order.status}</p>
                      {timer ? (
                        <p className={`font-mono text-xs ${timer.urgent ? 'text-status-error' : 'text-status-warning'}`}>
                          {timer.text}
                        </p>
                      ) : null}
                    </div>
                  </header>

                  <ul className="mt-2 space-y-0.5 text-sm">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-2">
                        <span className="min-w-0">
                          <span className="font-semibold">{item.quantity}×</span> {item.name}
                          {item.modifiers.length ? (
                            <span className="block text-xs text-text-muted">{item.modifiers.join(', ')}</span>
                          ) : null}
                          {item.notes ? <span className="block text-xs text-text-muted">{item.notes}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {order.notes ? <p className="mt-1 text-xs text-text-secondary">{order.notes}</p> : null}
                  {agg?.unmappedItems.length ? (
                    <p className="mt-1 text-xs text-status-warning">
                      Not linked to menu: {agg.unmappedItems.join(', ')}
                    </p>
                  ) : null}
                  {agg?.rider ? (
                    <p className="mt-1 text-xs text-text-secondary">
                      Rider: {agg.rider.state}
                      {agg.rider.name ? ` · ${agg.rider.name}` : ''}
                      {agg.rider.phone ? ` · ${agg.rider.phone}` : ''}
                    </p>
                  ) : null}
                  {agg?.rejectReason && order.status === 'cancelled' ? (
                    <p className="mt-1 text-xs text-status-error">{agg.rejectReason}</p>
                  ) : null}

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-semibold">{formatMoney(Math.round(order.total * 100))}</span>
                    {agg?.prepTimeMinutes && !done ? (
                      <span className="text-xs text-text-muted">Prep {agg.prepTimeMinutes} min</span>
                    ) : null}
                  </div>

                  {agg?.statusSync && !agg.statusSync.ok ? (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-status-error/10 px-2 py-1.5 text-xs text-status-error">
                      <span className="min-w-0 truncate">
                        {agg.statusSync.status} not sent: {agg.statusSync.error}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => action.mutate({ kind: 'retry', order })}
                        className="shrink-0 font-semibold underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}

                  {order.status === 'draft' ? (
                    rejectingId === order.id ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {REJECT_REASONS.map((reason) => (
                          <button
                            key={reason}
                            type="button"
                            disabled={busy}
                            onClick={() => action.mutate({ kind: 'reject', order, reason })}
                            className="rounded-md border border-status-error/40 px-2 py-1 text-xs text-status-error"
                          >
                            {reason}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setRejectingId(null)}
                          className="px-2 py-1 text-xs text-text-muted"
                        >
                          Back
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-2">
                        <select
                          value={prep}
                          onChange={(e) => setPrepById((m) => ({ ...m, [order.id]: Number(e.target.value) }))}
                          className="h-9 rounded-lg border border-line bg-bg-elevated px-2 text-sm"
                          aria-label="Prep time"
                        >
                          {PREP_TIMES.map((t) => (
                            <option key={t} value={t}>
                              {t} min
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => action.mutate({ kind: 'accept', order, prep })}
                          className="h-9 flex-1 rounded-lg bg-brand-primary text-sm font-semibold text-on-brand disabled:opacity-50"
                        >
                          {busy ? '…' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setRejectingId(order.id)}
                          className="h-9 rounded-lg border border-status-error/40 px-3 text-sm text-status-error"
                        >
                          Reject
                        </button>
                      </div>
                    )
                  ) : null}

                  {order.status === 'confirmed' || order.status === 'preparing' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => action.mutate({ kind: 'ready', order })}
                      className="mt-3 h-9 w-full rounded-lg bg-brand-primary text-sm font-semibold text-on-brand disabled:opacity-50"
                    >
                      Food ready
                    </button>
                  ) : null}
                  {order.status === 'ready' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => action.mutate({ kind: 'dispatch', order })}
                      className="mt-3 h-9 w-full rounded-lg bg-brand-primary text-sm font-semibold text-on-brand disabled:opacity-50"
                    >
                      Handed to rider
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
