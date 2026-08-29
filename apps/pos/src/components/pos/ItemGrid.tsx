interface ItemGridProps {
  items: Array<{ id: string; name: string; price: number; isAvailable: boolean }>;
  onAdd: (item: { id: string; name: string; price: number }) => void;
}

export function ItemGrid({ items, onAdd }: ItemGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 p-12 text-text-muted">
        No items in this category
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={!item.isAvailable}
          onClick={() => onAdd({ id: item.id, name: item.name, price: item.price })}
          className="flex min-h-[100px] flex-col items-start justify-between rounded-xl border border-white/10 bg-bg-card p-4 text-left transition active:scale-[0.98] hover:border-brand-primary/40 hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="line-clamp-2 text-base font-semibold leading-tight">{item.name}</span>
          <span className="mt-2 font-mono text-sm text-brand-primary">
            ₹{(item.price / 100).toFixed(0)}
          </span>
        </button>
      ))}
    </div>
  );
}
