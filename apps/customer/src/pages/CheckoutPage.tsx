import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Button, Input } from '@/components/ui/Form';
import { formatPrice, hasApiAccess, ordersApi } from '@/lib/api';
import { useCartStore } from '@/stores/cart';
import { useSessionStore } from '@/stores/session';

export function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total());
  const clearCart = useCartStore((s) => s.clear);
  const outletId = useSessionStore((s) => s.outletId);
  const tableId = useSessionStore((s) => s.tableId);
  const orderMode = useSessionStore((s) => s.orderMode);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [payLater, setPayLater] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState('');

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!outletId) throw new Error('Outlet not configured');
      const orderNotes = [
        name && `Guest: ${name}`,
        phone && `Phone: ${phone}`,
        notes,
        payLater ? 'Payment: Pay later' : 'Payment: Pay now',
      ]
        .filter(Boolean)
        .join(' · ');

      const order = await ordersApi.create({
        outletId,
        source: orderMode === 'dine-in' ? 'QR' : 'ONLINE',
        tableId: tableId ?? undefined,
        notes: orderNotes || undefined,
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          variantId: item.variantId,
          quantity: item.quantity,
          modifiers: item.modifiers.map((m) => ({
            name: m.name,
            price: m.price,
            modifierId: m.id,
          })),
          notes: item.notes,
        })),
      });

      await ordersApi.confirm(order.id);
      return order;
    },
    onSuccess: (order) => {
      clearCart();
      setSuccess(order.orderNumber);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Order failed');
    },
  });

  if (items.length === 0 && !success) {
    navigate('/cart');
    return null;
  }

  if (success) {
    return (
      <CustomerLayout showCart={false}>
        <div className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-ready/20 text-3xl">
            ✓
          </div>
          <h1 className="text-xl font-semibold">Order placed!</h1>
          <p className="mt-2 text-text-secondary">
            Order #{success} has been sent to the kitchen.
          </p>
          {payLater ? (
            <p className="mt-1 text-sm text-text-muted">Pay at the counter when ready.</p>
          ) : null}
          <Button className="mt-6 w-full" onClick={() => navigate('/')}>
            Order more
          </Button>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout showCart={false}>
      <div className="p-4">
        <button
          type="button"
          onClick={() => navigate('/cart')}
          className="mb-4 text-sm text-brand-primary"
        >
          ← Back to cart
        </button>

        <h1 className="mb-4 text-xl font-semibold">Checkout</h1>

        {!hasApiAccess() ? (
          <div className="mb-4 rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-sm text-status-warning">
            Configure <code>VITE_ORDER_TOKEN</code> to submit orders to the API.
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
            {error}
          </div>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            placeOrderMutation.mutate();
          }}
        >
          <Input
            label="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />

          <Input
            label="Phone (optional)"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 …"
          />

          <Input
            label="Order notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Allergies, seating preference…"
          />

          <div className="rounded-xl border border-white/10 bg-bg-card p-4">
            <p className="mb-3 text-sm font-medium">Payment</p>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                checked={payLater}
                onChange={() => setPayLater(true)}
                className="accent-brand-primary"
              />
              <span className="text-sm">Pay later at counter / table</span>
            </label>
            <label className="mt-2 flex cursor-pointer items-center gap-3 opacity-60">
              <input
                type="radio"
                checked={!payLater}
                onChange={() => setPayLater(false)}
                disabled
                className="accent-brand-primary"
              />
              <span className="text-sm">Pay now (coming soon)</span>
            </label>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-bg-elevated p-4">
            <span className="font-medium">Total due</span>
            <span className="text-xl font-semibold text-brand-primary">{formatPrice(total)}</span>
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={placeOrderMutation.isPending}
            disabled={!hasApiAccess() || !outletId}
          >
            {payLater ? 'Place order · Pay later' : 'Place order & pay'}
          </Button>
        </form>
      </div>
    </CustomerLayout>
  );
}
