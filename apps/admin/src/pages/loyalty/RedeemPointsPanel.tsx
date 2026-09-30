import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, Input, PhoneField } from '@cullinos/ui';
import {
  customersApi,
  feedbackApi,
  loyaltyApi,
  menuApi,
  ordersApi,
  outletsApi,
  paymentsApi,
  posApi,
  type Customer,
  type LoyaltySettings,
} from '@/lib/api';
import { formatMoney, generateIdempotencyKey } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';
import { printWithProfile, type PrintableOrder } from '@/features/pos/printHelper';

type CartLine = { menuItemId: string; name: string; price: number; quantity: number };

/**
 * Owner-side order where the bill is paid with a customer's loyalty points.
 * Menu prices are in paise; loyalty values and payment balances are in rupees.
 */
export function RedeemPointsPanel({ settings }: { settings: LoyaltySettings | undefined }) {
  const queryClient = useQueryClient();
  const outletId = useAuthStore((s) => s.selectedOutletId);

  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pointsOverride, setPointsOverride] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const outlet = outletsQuery.data?.find((o) => o.id === outletId);

  const menuQuery = useQuery({
    queryKey: ['menu', outletId],
    queryFn: () => menuApi.getOutletMenu(outletId!),
    enabled: Boolean(outletId),
  });

  const shiftQuery = useQuery({
    queryKey: ['pos', 'shift', outletId],
    queryFn: () => posApi.getOpenShift(outletId!),
    enabled: Boolean(outletId),
  });
  const hasOpenShift = Boolean((shiftQuery.data as { id?: string } | null | undefined)?.id);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (menuQuery.data?.items ?? []).filter(
      (item) => item.isAvailable !== false && (!q || item.name.toLowerCase().includes(q)),
    );
  }, [menuQuery.data?.items, search]);

  const redemptionValue = settings?.redemptionValue ?? 0;
  const minRedeem = settings?.minRedeem ?? 0;
  const balance = customer?.loyaltyPoints ?? 0;
  const subtotalPaise = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const subtotalRupees = subtotalPaise / 100;
  const maxUsable =
    redemptionValue > 0 ? Math.min(balance, Math.ceil(subtotalRupees / redemptionValue)) : 0;
  const points = pointsOverride ?? maxUsable;
  const pointsValueRupees = Math.min(points * redemptionValue, subtotalRupees);
  const cashDueRupees = Math.max(0, subtotalRupees - pointsValueRupees);

  function updateQty(item: { id: string; name: string; price: number }, delta: number) {
    setMessage(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (!existing) {
        return delta > 0
          ? [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }]
          : prev;
      }
      return prev
        .map((l) => (l.menuItemId === item.id ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0);
    });
  }

  const lookupMutation = useMutation({
    mutationFn: async () => {
      const q = phone.trim();
      if (!q) throw new Error('Enter a mobile number');
      const digits = q.replace(/\D/g, '');
      const matches = await customersApi.list(q);
      const match =
        matches.find((c) => c.phone?.replace(/\D/g, '').endsWith(digits)) ?? matches[0];
      if (!match) throw new Error('No customer found with this mobile number');
      return match;
    },
    onSuccess: (found) => {
      setCustomer(found);
      setPointsOverride(null);
      setMessage(null);
    },
    onError: (err: Error) => {
      setCustomer(null);
      setMessage({ type: 'error', text: err.message });
    },
  });

  const openShiftMutation = useMutation({
    mutationFn: () => posApi.openShift(outletId!, 0),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pos', 'shift', outletId] }),
    onError: (err: Error) => setMessage({ type: 'error', text: err.message }),
  });

  const placeMutation = useMutation({
    mutationFn: async () => {
      if (!outletId) throw new Error('Select an outlet first');
      if (!customer) throw new Error('Find the customer first');
      if (cart.length === 0) throw new Error('Add at least one item');
      if (!settings) throw new Error('Loyalty settings unavailable');
      if (!hasOpenShift) throw new Error('Open a cashier shift before placing the order');
      if (points <= 0) throw new Error('Enter the points to redeem');
      if (points < minRedeem) throw new Error(`Minimum ${minRedeem} points to redeem`);
      if (points > balance) throw new Error('Customer does not have enough points');

      const orderItems = cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity }));
      const key = generateIdempotencyKey();
      let order: { id: string; orderNumber: string };
      try {
        order = await posApi.quickOrder(
          { outletId, items: orderItems, customerId: customer.id, customerName: customer.name, autoConfirm: true },
          key,
        );
      } catch {
        order = await ordersApi.create(
          { outletId, source: 'POS', items: orderItems, customerId: customer.id },
          key,
        );
      }

      let redeemed: Awaited<ReturnType<typeof loyaltyApi.redeem>>;
      try {
        redeemed = await loyaltyApi.redeem(customer.id, points, order.id);
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Redeem failed';
        throw new Error(`Order #${order.orderNumber} was created but points were not applied: ${reason}`);
      }

      const balanceAfter = await paymentsApi.getBalance(order.id);
      let cashCollected = 0;
      if (balanceAfter.remaining > 0) {
        const cash = await paymentsApi.payCash(order.id);
        cashCollected = typeof cash.paidAmount === 'number' ? cash.paidAmount : balanceAfter.remaining;
      }

      return { order, redeemed, cashCollected };
    },
    onSuccess: ({ order, redeemed, cashCollected }) => {
      setMessage({
        type: 'success',
        text:
          `Order #${order.orderNumber} placed · ${redeemed.pointsRedeemed} pts (₹${redeemed.discountAmount.toFixed(2)})` +
          (cashCollected > 0 ? ` · ₹${cashCollected.toFixed(2)} cash collected` : ''),
      });
      setCustomer((c) => (c ? { ...c, loyaltyPoints: redeemed.remainingPoints } : c));
      setCart([]);
      setPointsOverride(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['pos', 'shift', outletId] });
      if (outletId) void printOrder(order.id, outletId, outlet?.name ?? null, outlet?.gstin ?? null);
    },
    onError: (err: Error) => setMessage({ type: 'error', text: err.message }),
  });

  if (!outletId) {
    return (
      <section className="rounded-xl border border-line-subtle bg-bg-card p-5">
        <h2 className="font-semibold">Redeem points</h2>
        <p className="mt-2 text-sm text-text-muted">
          Select an outlet from the top bar to place a loyalty redemption order.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-line-subtle bg-bg-card p-5">
      <h2 className="font-semibold">Redeem points</h2>
      <p className="mt-1 text-sm text-text-muted">
        Place an order for a customer and pay it with their loyalty points. Any balance left is
        collected in cash.
      </p>

      {message ? (
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'border-brand-primary/30 bg-brand-primary/10 text-brand-primary'
              : 'border-status-error/30 bg-status-error/10 text-status-error'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {!shiftQuery.isLoading && !hasOpenShift ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-warning/30 bg-status-warning/5 px-3 py-2 text-sm">
          <span className="text-status-warning">
            No cashier shift is open at {outlet?.name ?? 'this outlet'}.
          </span>
          <Button
            type="button"
            variant="secondary"
            loading={openShiftMutation.isPending}
            onClick={() => openShiftMutation.mutate()}
          >
            Open shift
          </Button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1 sm:max-w-xs">
          <PhoneField label="Customer mobile" value={phone} onChange={setPhone} />
        </div>
        <Button
          type="button"
          variant="secondary"
          loading={lookupMutation.isPending}
          disabled={!phone.trim()}
          onClick={() => lookupMutation.mutate()}
        >
          Find
        </Button>
        {customer ? (
          <div className="flex min-w-0 items-center gap-3 rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{customer.name}</p>
              <p className="text-xs text-brand-primary">
                {customer.loyaltyPoints} pts · worth ₹
                {(customer.loyaltyPoints * redemptionValue).toFixed(2)}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 text-xs text-text-muted hover:text-text-primary"
              onClick={() => {
                setCustomer(null);
                setPhone('');
                setPointsOverride(null);
              }}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>

      {customer ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Input
              label="Search menu"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Item name"
            />
            {menuQuery.isLoading ? (
              <p className="mt-3 text-sm text-text-muted">Loading menu…</p>
            ) : (
              <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateQty(item, 1)}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line-subtle bg-bg-elevated/50 px-3 py-2 text-left text-sm hover:border-brand-primary/40"
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="shrink-0 font-mono text-xs text-brand-primary">
                      {formatMoney(item.price)}
                    </span>
                  </button>
                ))}
                {items.length === 0 ? (
                  <p className="text-sm text-text-muted">No items match.</p>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-3 lg:col-span-2">
            <h3 className="text-sm font-medium text-text-secondary">Order</h3>
            {cart.length === 0 ? (
              <p className="text-sm text-text-muted">Tap menu items to add them.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {cart.map((line) => (
                  <li key={line.menuItemId} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate">{line.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Remove one ${line.name}`}
                        onClick={() => updateQty({ id: line.menuItemId, name: line.name, price: line.price }, -1)}
                        className="h-7 w-7 rounded border border-line hover:bg-hover"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-mono">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${line.name}`}
                        onClick={() => updateQty({ id: line.menuItemId, name: line.name, price: line.price }, 1)}
                        className="h-7 w-7 rounded border border-line hover:bg-hover"
                      >
                        +
                      </button>
                    </div>
                    <span className="w-16 text-right font-mono text-xs">
                      {formatMoney(line.price * line.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex justify-between border-t border-line-subtle pt-3 text-sm">
              <span>Subtotal</span>
              <span className="font-mono">{formatMoney(subtotalPaise)}</span>
            </div>

            <Input
              label={`Points to redeem (min ${minRedeem})`}
              type="number"
              min={0}
              max={balance}
              value={String(points)}
              onChange={(e) =>
                setPointsOverride(
                  Math.min(balance, Math.max(0, Math.floor(Number(e.target.value) || 0))),
                )
              }
            />

            <div className="rounded-lg border border-line-subtle bg-bg-elevated/50 px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Points cover</span>
                <span className="font-mono text-brand-primary">₹{pointsValueRupees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Estimated cash (before tax)</span>
                <span className="font-mono">₹{cashDueRupees.toFixed(2)}</span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Taxes are added when the order is placed. The exact cash amount is taken from the
                order balance and shown after placing.
              </p>
            </div>

            <Button
              type="button"
              className="w-full"
              loading={placeMutation.isPending}
              disabled={cart.length === 0 || points <= 0 || !hasOpenShift}
              onClick={() => placeMutation.mutate()}
            >
              Place order with points
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

async function printOrder(
  orderId: string,
  outletId: string,
  outletName: string | null,
  gstin: string | null,
) {
  try {
    const order = await ordersApi.get(orderId);
    const toRupees = (paise: number) => paise / 100;
    const printable: PrintableOrder = {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      notes: order.notes,
      outletName,
      gstin,
      subtotal: toRupees(order.subtotal ?? 0),
      taxTotal: toRupees(order.taxTotal ?? 0),
      total: toRupees(order.totalAmount ?? 0),
      taxLines: (order.taxLines ?? []).map((t) => ({
        taxName: t.taxName,
        amount: toRupees(t.amount),
        rate: t.rate,
      })),
      items: (order.items ?? []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: toRupees(item.unitPrice),
        notes: item.notes,
      })),
    };
    try {
      printable.feedbackUrl = (await feedbackApi.surveyLink(orderId)).url;
    } catch {
      /* optional */
    }
    await printWithProfile('kot', outletId, printable, { orderId });
    await printWithProfile('receipt', outletId, printable, { orderId });
  } catch {
    /* printing is best-effort; the order is already placed and paid */
  }
}
