import type { MenuItem } from '@/lib/api';
import { formatPrice } from '@/lib/api';
import { Badge } from '@cullinos/ui';

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
      className="flex w-full gap-3 overflow-hidden rounded-2xl border border-white/10 bg-bg-card text-left transition hover:border-brand-primary/40 active:scale-[0.99] disabled:opacity-50"
    >
      <div className="relative h-28 w-28 shrink-0 bg-bg-elevated">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-end bg-gradient-to-br from-bg-elevated via-bg-card to-brand-primary/20 p-2"
            aria-hidden
          >
            <span className="font-display text-xs font-bold tracking-tight text-brand-primary/80">
              Cullinos.
            </span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 py-3 pr-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold leading-tight tracking-tight">{item.name}</h3>
          <span className="shrink-0 font-mono text-sm font-semibold text-brand-primary">
            {formatPrice(item.price)}
          </span>
        </div>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{item.description}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hasCustomizations ? <Badge variant="brand">Customizable</Badge> : null}
          {!item.isAvailable ? <Badge variant="neutral">Unavailable</Badge> : null}
        </div>
      </div>
    </button>
  );
}
