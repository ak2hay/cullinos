import { formatMoney } from '@/lib/format';
import { useCartStore } from '@/stores/cart';

interface CartSidebarProps {
  onCheckout: () => void;
  onHold: () => void;
  onClear: () => void;
  checkoutLoading: boolean;
  holdLoading: boolean;
}

export function CartSidebar({
  onCheckout,
  onHold,
  onClear,
  checkoutLoading,
  holdLoading,
}: CartSidebarProps) {
  const lines = useCartStore((s) => s.lines);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = useCartStore((s) => s.subtotal());
  const itemCount = useCartStore((s) => s.itemCount());

  return (
    <aside className="flex w-full shrink-0 flex-col border-l border-white/5 bg-bg-secondary lg:w-96">
      <div className="border-b border-white/5 px-5 py-4">
        <h2 className="text-lg font-semibold">Current order</h2>
        <p className="text-sm text-text-muted">{itemCount} items</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {lines.length === 0 ? (
          <p className="py-8 text-center text-text-muted">Tap items to add to cart</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((line) => (
              <li
                key={line.menuItemId}
                className="rounded-xl border border-white/5 bg-bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-tight">{line.name}</p>
                  <button
                    type="button"
                    onClick={() => removeItem(line.menuItemId)}
                    className="text-sm text-text-muted hover:text-status-error"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.menuItemId, line.quantity - 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated text-lg font-bold active:scale-95"
                    >
                      −
                    </button>
                    <span className="min-w-[2rem] text-center font-mono text-lg">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.menuItemId, line.quantity + 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/20 text-lg font-bold text-brand-primary active:scale-95"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-mono text-brand-primary">
                    {formatMoney(line.unitPrice * line.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-white/5 p-4">
        <div className="flex items-center justify-between text-lg">
          <span className="text-text-secondary">Subtotal</span>
          <span className="font-mono font-semibold text-brand-primary">
            {formatMoney(subtotal)}
          </span>
        </div>

        <button
          type="button"
          disabled={lines.length === 0 || checkoutLoading}
          onClick={onCheckout}
          className="h-14 w-full rounded-xl bg-brand-primary text-lg font-bold text-bg-primary transition active:scale-[0.98] disabled:opacity-40"
        >
          {checkoutLoading ? 'Processing…' : 'Charge (Enter)'}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={lines.length === 0 || holdLoading}
            onClick={onHold}
            className="h-12 rounded-xl border border-white/10 bg-bg-elevated font-medium transition active:scale-[0.98] disabled:opacity-40"
          >
            {holdLoading ? 'Holding…' : 'Hold (H)'}
          </button>
          <button
            type="button"
            disabled={lines.length === 0}
            onClick={onClear}
            className="h-12 rounded-xl border border-white/10 bg-bg-elevated font-medium text-status-error transition active:scale-[0.98] disabled:opacity-40"
          >
            Clear (Esc)
          </button>
        </div>
      </div>
    </aside>
  );
}
