import type { MenuItem } from '@/lib/api';
import { formatPrice } from '@/lib/api';

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
}

export function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  const hasCustomizations =
    (item.modifierGroups?.length ?? 0) > 0 || (item.variants?.length ?? 0) > 0;

  return (
    <button
      type="button"
      disabled={!item.isAvailable}
      onClick={() => onSelect(item)}
      className="flex w-full gap-3 rounded-xl border border-white/10 bg-bg-card p-3 text-left transition hover:border-brand-primary/30 disabled:opacity-50"
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-2xl">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full rounded-lg object-cover" />
        ) : (
          '🍽️'
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium leading-tight">{item.name}</h3>
          <span className="shrink-0 text-sm font-semibold text-brand-primary">
            {formatPrice(item.price)}
          </span>
        </div>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{item.description}</p>
        ) : null}
        {hasCustomizations ? (
          <span className="mt-1 inline-block text-xs text-text-muted">Customizable</span>
        ) : null}
      </div>
    </button>
  );
}
