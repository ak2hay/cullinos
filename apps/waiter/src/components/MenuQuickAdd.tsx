import { useState } from 'react';
import type { MenuItem, OrderItem } from '@/lib/api';
import { Button } from './ui/Form';

interface MenuQuickAddProps {
  items: MenuItem[];
  onAdd: (item: OrderItem) => void;
  loading?: boolean;
}

export function MenuQuickAdd({ items, onAdd, loading }: MenuQuickAddProps) {
  const [search, setSearch] = useState('');

  const filtered = items.filter(
    (item) =>
      item.isAvailable &&
      item.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Search menu…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-10 w-full rounded-lg border border-white/10 bg-bg-card px-3 text-sm outline-none focus:border-brand-primary"
      />

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={loading}
            onClick={() =>
              onAdd({
                menuItemId: item.id,
                quantity: 1,
              })
            }
            className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-bg-elevated px-3 py-2.5 text-left transition hover:border-brand-primary/30 active:bg-bg-card disabled:opacity-50"
          >
            <span className="text-sm font-medium">{item.name}</span>
            <span className="text-sm text-brand-primary">
              ₹{(item.price / 100).toFixed(0)}
            </span>
          </button>
        ))}
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-muted">No items found</p>
        ) : null}
      </div>

      <p className="text-xs text-text-muted">Tap an item to add to the order</p>
    </div>
  );
}

interface QuickAddBarProps {
  items: MenuItem[];
  onQuickAdd: (items: OrderItem[]) => void;
  loading?: boolean;
}

export function QuickAddBar({ items, onQuickAdd, loading }: QuickAddBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-white/10 bg-bg-secondary p-4">
      {open ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Quick add items</h3>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          <MenuQuickAdd
            items={items}
            loading={loading}
            onAdd={(item) => {
              onQuickAdd([item]);
            }}
          />
        </div>
      ) : (
        <Button className="w-full" onClick={() => setOpen(true)}>
          + Quick add items
        </Button>
      )}
    </div>
  );
}
