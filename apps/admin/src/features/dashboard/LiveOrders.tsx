import { Link } from 'react-router-dom';
import { ChevronRight, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { Skeleton } from '@cullinos/ui';
import type { Order } from '@/lib/api';
import { formatMoney } from '@/lib/format';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-hover-strong text-text-secondary' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-status-success/12 text-status-success' },
  PREPARING: { label: 'Preparing', className: 'bg-status-warning/12 text-status-warning' },
  READY: { label: 'Ready', className: 'bg-status-info/12 text-status-info' },
  SERVED: { label: 'Served', className: 'bg-status-new/12 text-status-new' },
  HELD: { label: 'Held', className: 'bg-hover-strong text-text-secondary' },
};

function serviceLabel(order: Order) {
  const raw = (order.type ?? order.source ?? '').toString().toLowerCase().replace(/_/g, ' ');
  if (!raw) return null;
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function LiveOrders({ orders, loading }: { orders: Order[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line py-10 text-center">
        <ShoppingBag size={24} className="text-text-muted" aria-hidden="true" />
        <p className="text-sm font-medium text-text-secondary">No open orders right now</p>
        <p className="text-xs text-text-muted">New orders will appear here automatically.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {orders.map((order, i) => {
        const status = STATUS_STYLES[String(order.status).toUpperCase()] ?? {
          label: String(order.status),
          className: 'bg-hover-strong text-text-secondary',
        };
        const service = serviceLabel(order);
        return (
          <li key={order.id} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
            <Link
              to="/orders"
              className="group flex items-center gap-3 rounded-xl border border-line-subtle px-3 py-2.5 transition-colors hover:border-line hover:bg-hover"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-success/12 text-status-success">
                <UtensilsCrossed size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-text-primary">
                    #{order.orderNumber}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-text-muted">
                  {[order.tableName ? `Table ${order.tableName}` : order.customerName, service]
                    .filter(Boolean)
                    .join(' · ') || 'Walk-in'}
                  {' · '}
                  {timeLabel(order.createdAt)}
                </span>
              </span>
              <span className="font-mono text-sm font-semibold text-text-primary">
                {formatMoney(order.totalAmount)}
              </span>
              <ChevronRight
                size={16}
                className="text-text-muted transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
