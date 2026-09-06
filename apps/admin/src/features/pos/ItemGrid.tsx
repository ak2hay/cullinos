interface ItemGridProps {
  items: Array<{ id: string; name: string; price: number; isAvailable: boolean }>;
  quantities?: Record<string, number>;
  onAdd: (item: { id: string; name: string; price: number }) => void;
  emptyHint?: string;
}

export function ItemGrid({ items, quantities = {}, onAdd, emptyHint }: ItemGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-bg-card/40 p-12 text-center">
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => {
        const qty = quantities[item.id] ?? 0;
        return (
          <button
            key={item.id}
            type="button"
            disabled={!item.isAvailable}
            onClick={() => onAdd({ id: item.id, name: item.name, price: item.price })}
            className="group relative flex min-h-[112px] flex-col items-start justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-bg-card to-bg-elevated/80 p-4 text-left shadow-sm transition hover:border-brand-primary/50 hover:shadow-md hover:shadow-brand-primary/10 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {qty > 0 ? (
              <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-primary px-2 font-mono text-sm font-bold text-bg-primary">
                {qty}
              </span>
            ) : null}
            <span className="line-clamp-2 pr-8 text-base font-semibold leading-tight text-text-primary">
              {item.name}
            </span>
            <span className="mt-3 rounded-lg bg-brand-primary/15 px-2.5 py-1 font-mono text-sm font-semibold text-brand-primary">
              ₹{(item.price / 100).toFixed(0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
