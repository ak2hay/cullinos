import type { Table } from '@/lib/api';
import { TABLE_STATUS_COLORS } from '@/lib/api';

interface TableCardProps {
  table: Table;
  activeOrderCount?: number;
  onSelect: () => void;
}

const statusLabels: Record<string, string> = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  RESERVED: 'Reserved',
  CLEANING: 'Cleaning',
  BILLING: 'Billing',
};

export function TableCard({ table, activeOrderCount = 0, onSelect }: TableCardProps) {
  const dotColor = TABLE_STATUS_COLORS[table.status] ?? 'bg-text-muted';

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full flex-col rounded-xl border border-white/10 bg-bg-card p-4 text-left transition hover:border-brand-primary/40 hover:bg-bg-elevated active:scale-[0.98]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-lg font-semibold">{table.name}</span>
        <span className={`h-3 w-3 rounded-full ${dotColor}`} title={table.status} />
      </div>
      <p className="text-xs text-text-secondary">
        {statusLabels[table.status] ?? table.status} · {table.capacity} seats
      </p>
      {table.section ? (
        <p className="mt-1 text-xs text-text-muted">{table.section.name}</p>
      ) : null}
      {activeOrderCount > 0 ? (
        <span className="mt-2 inline-flex w-fit rounded-full bg-brand-primary/20 px-2 py-0.5 text-xs font-medium text-brand-primary">
          {activeOrderCount} active order{activeOrderCount > 1 ? 's' : ''}
        </span>
      ) : null}
    </button>
  );
}
