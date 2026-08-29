import { useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '@cullinos/ui';
import type { Kot, KotItemStatus } from '@/lib/api';
import { kitchenApi } from '@/lib/api';
import { OrderTimer } from './OrderTimer';
import { Button } from './ui/Form';

const statusStyles: Record<string, { border: string; badge: string; label: string }> = {
  NEW: {
    border: 'border-status-new',
    badge: 'bg-status-new/20 text-status-new',
    label: 'NEW',
  },
  PREPARING: {
    border: 'border-status-preparing',
    badge: 'bg-status-preparing/20 text-status-preparing',
    label: 'PREPARING',
  },
  READY: {
    border: 'border-status-ready',
    badge: 'bg-status-ready/20 text-status-ready',
    label: 'READY',
  },
  SERVED: {
    border: 'border-text-muted',
    badge: 'bg-white/10 text-text-muted',
    label: 'SERVED',
  },
};

function nextStatus(current: string): KotItemStatus | null {
  if (current === 'NEW') return 'PREPARING';
  if (current === 'PREPARING') return 'READY';
  if (current === 'READY') return 'SERVED';
  return null;
}

interface KotCardProps {
  kot: Kot;
  outletId: string;
}

export function KotCard({ kot, outletId }: KotCardProps) {
  const queryClient = useQueryClient();
  const style = statusStyles[kot.status] ?? statusStyles.NEW;
  const tableLabel = kot.order.table?.name ?? kot.order.orderType;

  const updateMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: KotItemStatus }) =>
      kitchenApi.updateItemStatus(itemId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-display', outletId] });
    },
  });

  async function bumpAllItems() {
    const next = nextStatus(kot.status);
    if (!next) return;
    for (const item of kot.items) {
      if (item.status !== 'SERVED') {
        await updateMutation.mutateAsync({ itemId: item.id, status: next });
      }
    }
  }

  const next = nextStatus(kot.status);

  return (
    <article
      className={`flex flex-col rounded-xl border-2 bg-bg-card p-4 shadow-lg ${style.border}`}
      style={{ borderLeftColor: kot.status === 'NEW' ? colors.status.new : undefined }}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-brand-primary">#{kot.kotNumber}</span>
            {kot.priority > 0 ? (
              <span className="rounded-full bg-status-error/20 px-2 py-0.5 text-xs font-semibold text-status-error">
                PRIORITY
              </span>
            ) : null}
          </div>
          <p className="text-sm text-text-secondary">
            {tableLabel} · Order {kot.order.orderNumber}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${style.badge}`}>
            {style.label}
          </span>
          <OrderTimer createdAt={kot.createdAt} />
        </div>
      </header>

      <ul className="mb-4 flex-1 space-y-2">
        {kot.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-lg bg-bg-elevated/60 px-3 py-2 text-sm"
          >
            <span>
              <span className="font-semibold text-brand-primary">{item.quantity}×</span>{' '}
              {item.name}
              {item.notes ? (
                <span className="mt-0.5 block text-xs text-text-muted">{item.notes}</span>
              ) : null}
            </span>
            <span className={`text-xs font-medium ${statusStyles[item.status]?.badge ?? ''} rounded px-1.5 py-0.5`}>
              {item.status}
            </span>
          </li>
        ))}
      </ul>

      {kot.notes ? (
        <p className="mb-3 text-xs text-status-warning">Note: {kot.notes}</p>
      ) : null}

      {next ? (
        <Button
          variant={next === 'READY' ? 'success' : next === 'PREPARING' ? 'warning' : 'primary'}
          className="w-full"
          loading={updateMutation.isPending}
          onClick={() => void bumpAllItems()}
        >
          Mark {next === 'PREPARING' ? 'Preparing' : next === 'READY' ? 'Ready' : 'Served'}
        </Button>
      ) : null}
    </article>
  );
}
