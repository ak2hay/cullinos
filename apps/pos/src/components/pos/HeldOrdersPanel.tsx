import type { HeldOrder } from '@/stores/heldOrders';
import { formatMoney } from '@/lib/format';

interface HeldOrdersPanelProps {
  orders: HeldOrder[];
  onResume: (order: HeldOrder) => void;
  onDismiss: (id: string) => void;
  open: boolean;
  onToggle: () => void;
}

export function HeldOrdersPanel({
  orders,
  onResume,
  onDismiss,
  open,
  onToggle,
}: HeldOrdersPanelProps) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="relative rounded-xl border border-white/10 bg-bg-elevated px-4 py-2 text-sm font-medium transition hover:border-brand-primary/40"
      >
        Held orders
        {orders.length > 0 ? (
          <span className="ml-2 rounded-full bg-brand-primary px-2 py-0.5 text-xs font-bold text-bg-primary">
            {orders.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-white/10 bg-bg-secondary shadow-xl">
          <div className="border-b border-white/5 px-4 py-3">
            <p className="font-semibold">Held orders</p>
          </div>
          {orders.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted">No held orders</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between border-b border-white/5 px-4 py-3 last:border-0"
                >
                  <div>
                    <p className="font-mono text-sm">{order.orderNumber}</p>
                    <p className="text-xs text-text-muted">
                      {order.lines.length} items · {formatMoney(order.subtotal)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onResume(order)}
                      className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-bg-primary"
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismiss(order.id)}
                      className="rounded-lg px-2 py-1.5 text-xs text-text-muted hover:text-status-error"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </>
  );
}
