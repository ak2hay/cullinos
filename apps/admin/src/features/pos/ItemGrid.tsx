interface ItemGridProps {
  items: Array<{
    id: string;
    name: string;
    price: number;
    /** Set during happy hour when `price` is discounted */
    regularPrice?: number;
    isAvailable: boolean;
  }>;
  quantities?: Record<string, number>;
  onAdd: (item: { id: string; name: string; price: number }) => void;
  emptyHint?: string;
}

export function ItemGrid({ items, quantities = {}, onAdd, emptyHint }: ItemGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-bg-card/40 p-12 text-center">
        <p className="text-base text-text-secondary">
          {emptyHint ?? 'No items in this category.'}
        </p>
        <p className="max-w-sm text-sm text-text-muted">
          Add menu items in ERP → Menu, then refresh this screen.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => {
        const qty = quantities[item.id] ?? 0;
        return (
          <button
            key={item.id}
            type="button"
            disabled={!item.isAvailable}
            onClick={() => onAdd({ id: item.id, name: item.name, price: item.price })}
            className="group relative flex min-h-[64px] flex-col items-start justify-between overflow-hidden rounded-xl border border-line bg-gradient-to-br from-bg-card to-bg-elevated/80 p-2 text-left shadow-sm transition hover:border-brand-primary/50 hover:shadow-md hover:shadow-brand-primary/10 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {qty > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1.5 font-mono text-[11px] font-bold text-on-brand">
                {qty}
              </span>
            ) : null}
            <span className="line-clamp-2 pr-6 text-sm font-semibold leading-tight text-text-primary">
              {item.name}
            </span>
            <span className="mt-1.5 flex items-center gap-1.5">
              <span className="rounded-md bg-brand-primary/15 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-primary">
                ₹{(item.price / 100).toFixed(0)}
              </span>
              {item.regularPrice != null && item.regularPrice > item.price ? (
                <span className="font-mono text-[11px] text-text-muted line-through">
                  ₹{(item.regularPrice / 100).toFixed(0)}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
