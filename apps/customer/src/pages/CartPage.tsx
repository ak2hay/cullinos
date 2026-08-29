import { Link, useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Button } from '@/components/ui/Form';
import { useStorefrontBase } from '@/hooks/useStorefrontBase';
import { formatPrice } from '@/lib/api';
import { useCartStore } from '@/stores/cart';

export function CartPage() {
  const navigate = useNavigate();
  const base = useStorefrontBase();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const total = useCartStore((s) => s.total());

  return (
    <CustomerLayout showCart={false}>
      <div className="p-4">
        <button
          type="button"
          onClick={() => navigate(base)}
          className="mb-4 text-sm text-brand-primary"
        >
          ← Back to menu
        </button>

        <h1 className="mb-4 text-xl font-semibold">Your cart</h1>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/20 p-8 text-center">
            <p className="text-text-secondary">Your cart is empty.</p>
            <Link to={base} className="mt-3 inline-block text-sm text-brand-primary">
              Browse menu
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {items.map((item) => {
                const modTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
                const lineTotal = (item.unitPrice + modTotal) * item.quantity;
                return (
                  <li
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.variantName ? (
                          <p className="text-xs text-text-secondary">{item.variantName}</p>
                        ) : null}
                        {item.modifiers.length > 0 ? (
                          <p className="text-xs text-text-muted">
                            {item.modifiers.map((m) => m.name).join(', ')}
                          </p>
                        ) : null}
                        {item.notes ? (
                          <p className="text-xs text-status-warning">{item.notes}</p>
                        ) : null}
                      </div>
                      <span className="font-medium text-brand-primary">
                        {formatPrice(lineTotal)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-status-error"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
              <span className="font-medium">Total</span>
              <span className="text-xl font-semibold text-brand-primary">{formatPrice(total)}</span>
            </div>

            <Button className="mt-4 w-full" onClick={() => navigate(`${base}/checkout`)}>
              Proceed to checkout
            </Button>
          </>
        )}
      </div>
    </CustomerLayout>
  );
}
