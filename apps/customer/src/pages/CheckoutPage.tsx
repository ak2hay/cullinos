import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLoginModal } from '@/components/CustomerLoginModal';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Button, Input } from '@cullinos/ui';
import { useStorefrontBase } from '@/hooks/useStorefrontBase';
import {
  ApiRequestError,
  formatPrice,
  loyaltyApi,
  ordersApi,
  sessionsApi,
} from '@/lib/api';
import { useCartStore } from '@/stores/cart';
import { useCustomerAuthStore } from '@/stores/customerAuth';
import { useSessionStore } from '@/stores/session';

export function CheckoutPage() {
  const navigate = useNavigate();
  const base = useStorefrontBase();
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total());
  const clearCart = useCartStore((s) => s.clear);
  const organizationId = useSessionStore((s) => s.organizationId);
  const outletId = useSessionStore((s) => s.outletId);
  const tableId = useSessionStore((s) => s.tableId);
  const sessionToken = useSessionStore((s) => s.sessionToken);
  const tableName = useSessionStore((s) => s.tableName);
  const orderMode = useSessionStore((s) => s.orderMode);

  const accessToken = useCustomerAuthStore((s) => s.accessToken);
  const customer = useCustomerAuthStore((s) => s.customer);
  const updateCustomer = useCustomerAuthStore((s) => s.updateCustomer);

  const [notes, setNotes] = useState('');
  const [scheduledPickup, setScheduledPickup] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const [payLater, setPayLater] = useState(true);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [selectedRewardId, setSelectedRewardId] = useState<string>('');
  const [success, setSuccess] = useState<{
    orderNumber: string;
    pickupCode: string;
    orderId: string;
  } | null>(null);
  const [error, setError] = useState('');

  const loyaltyQuery = useQuery({
    queryKey: ['loyalty-settings', organizationId],
    queryFn: () => loyaltyApi.getSettings(organizationId!),
    enabled: Boolean(organizationId && customer),
  });

  const rewardsQuery = useQuery({
    queryKey: ['loyalty-rewards', organizationId],
    queryFn: () => loyaltyApi.listRewards(organizationId!),
    enabled: Boolean(organizationId && customer),
  });

  const redeemPreview = useMemo(() => {
    const settings = loyaltyQuery.data;
    if (!settings || !redeemPoints || redeemPoints <= 0) return null;
    return {
      discountAmount: redeemPoints * settings.redemptionValue,
      minRedeem: settings.minRedeem,
    };
  }, [loyaltyQuery.data, redeemPoints]);

  const dueTotal = useMemo(() => {
    const tipPaise = tipAmount > 0 ? tipAmount * 100 : 0;
    const discountPaise = redeemPreview
      ? Math.round(redeemPreview.discountAmount * 100)
      : 0;
    return Math.max(0, total + tipPaise - discountPaise);
  }, [total, tipAmount, redeemPreview]);

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!outletId || !organizationId) throw new Error('Store not loaded');
      if (!customer || !accessToken) throw new Error('Sign in required');

      const settings = loyaltyQuery.data;
      if (redeemPoints > 0) {
        if (!settings) throw new Error('Loyalty settings unavailable');
        if (redeemPoints < settings.minRedeem) {
          throw new Error(`Minimum ${settings.minRedeem} points to redeem`);
        }
        if (redeemPoints > customer.loyaltyPoints) {
          throw new Error('Not enough loyalty points');
        }
      }

      const orderNotes = [
        `Guest: ${customer.name}`,
        `Phone: ${customer.phone}`,
        notes,
        redeemPoints > 0 ? `Redeem: ${redeemPoints} pts` : null,
        payLater ? 'Payment: Pay later' : 'Payment: Pay now',
      ]
        .filter(Boolean)
        .join(' · ');

      const mappedItems = items.map((item) => ({
        menuItemId: item.menuItemId,
        variantId: item.variantId,
        quantity: item.quantity,
        modifiers: item.modifiers.map((m) => ({
          name: m.name,
          price: m.price,
          modifierId: m.id,
        })),
        notes: item.notes,
      }));

      let order;
      if (sessionToken) {
        await sessionsApi.addItems(sessionToken, {
          items: mappedItems,
          customerName: customer.name,
          notes: orderNotes || undefined,
        });
        order = await sessionsApi.submit(sessionToken);
      } else {
        order = await ordersApi.create({
          organizationId,
          outletId,
          source: orderMode === 'dine-in' ? 'QR' : 'ONLINE',
          tableId: tableId ?? undefined,
          customerId: customer.id,
          customerName: customer.name,
          scheduledPickupAt: scheduledPickup
            ? new Date(scheduledPickup).toISOString()
            : undefined,
          tipAmount: tipAmount || undefined,
          notes: orderNotes || undefined,
          items: mappedItems,
        });
      }

      if (redeemPoints > 0) {
        try {
          const redeem = await loyaltyApi.redeem(organizationId, accessToken, {
            points: redeemPoints,
            orderId: order.id,
          });
          updateCustomer({
            loyaltyPoints: redeem.remainingPoints,
          });
        } catch (err) {
          console.warn('Loyalty redeem failed', err);
        }
      }

      if (selectedRewardId) {
        try {
          const reward = await loyaltyApi.redeemReward(organizationId, accessToken, {
            rewardId: selectedRewardId,
            orderId: order.id,
          });
          updateCustomer({
            loyaltyPoints: reward.remainingPoints,
          });
        } catch (err) {
          console.warn('Reward redeem failed', err);
        }
      }

      return order;
    },
    onSuccess: (order) => {
      clearCart();
      setSuccess({
        orderNumber: order.orderNumber,
        pickupCode: order.pickupCode || order.orderNumber,
        orderId: order.id,
      });
    },
    onError: (err) => {
      setError(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : 'Order failed',
      );
    },
  });

  if (items.length === 0 && !success) {
    navigate(`${base}/cart`);
    return null;
  }

  if (success) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      JSON.stringify({
        code: success.pickupCode,
        orderId: success.orderId,
        outletId,
      }),
    )}`;
    return (
      <CustomerLayout showCart={false}>
        <div className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-ready/20 text-3xl">
            ✓
          </div>
          <h1 className="text-xl font-semibold">Order placed!</h1>
          <p className="mt-6 text-sm uppercase tracking-widest text-text-muted">Your code</p>
          <p className="mt-2 font-mono text-6xl font-bold leading-none tracking-widest text-brand-primary sm:text-7xl">
            {success.pickupCode}
          </p>
          <img
            src={qrUrl}
            alt={`QR for code ${success.pickupCode}`}
            className="mx-auto mt-6 h-44 w-44 rounded-2xl bg-white p-3"
          />
          <p className="mt-4 text-text-secondary">
            Show this code (or the printed slip) at the counter / pickup board.
          </p>
          <p className="mt-1 text-xs text-text-muted">Kitchen #{success.orderNumber}</p>
          {payLater ? (
            <p className="mt-1 text-sm text-text-muted">Pay at the counter when ready.</p>
          ) : null}
          <Button className="mt-8 w-full" onClick={() => navigate(base)}>
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
          onClick={() => navigate(`${base}/cart`)}
          className="mb-4 text-sm text-brand-primary"
        >
          ← Back to cart
        </button>

        <h1 className="mb-4 text-xl font-semibold">Checkout</h1>

        {orderMode === 'dine-in' && tableName ? (
          <p className="mb-4 rounded-lg bg-brand-primary/10 px-3 py-2 text-sm text-brand-primary">
            Sending to table order: {tableName}
          </p>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
            {error}
          </div>
        ) : null}

        {!customer ? (
          <div className="mb-6">
            <p className="mb-3 text-sm text-text-secondary">
              Sign in with OTP to place your order and earn loyalty points.
            </p>
            <CustomerLoginModal
              open
              inline
              orgId={organizationId}
              onClose={() => undefined}
              title="Sign in to checkout"
            />
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              placeOrderMutation.mutate();
            }}
          >
            <div className="rounded-xl border border-white/10 bg-bg-card p-4">
              <p className="text-sm font-medium text-text-primary">{customer.name}</p>
              <p className="text-sm text-text-secondary">{customer.phone}</p>
              <p className="mt-2 text-sm text-brand-primary">
                {customer.loyaltyPoints} loyalty points
                {customer.stampCount > 0 ? ` · ${customer.stampCount} stamps` : ''}
              </p>
            </div>

            <Input
              label="Order notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, seating preference…"
            />

            {customer.loyaltyPoints > 0 ? (
              <div className="space-y-2 rounded-xl border border-white/10 bg-bg-card p-4">
                <Input
                  label={`Redeem points${
                    loyaltyQuery.data ? ` (min ${loyaltyQuery.data.minRedeem})` : ''
                  }`}
                  type="number"
                  min={0}
                  max={customer.loyaltyPoints}
                  value={redeemPoints || ''}
                  onChange={(e) => setRedeemPoints(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                />
                {redeemPreview && redeemPoints > 0 ? (
                  <p className="text-xs text-text-secondary">
                    ≈ ₹{redeemPreview.discountAmount.toFixed(0)} off · balance after:{' '}
                    {customer.loyaltyPoints - redeemPoints} pts
                  </p>
                ) : null}
                {(rewardsQuery.data ?? []).length > 0 ? (
                  <div className="space-y-2 border-t border-white/5 pt-3">
                    <p className="text-sm font-medium">Or redeem a reward</p>
                    {(rewardsQuery.data ?? []).map((reward) => {
                      const affordable = customer.loyaltyPoints >= reward.pointsCost;
                      return (
                        <label
                          key={reward.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                            selectedRewardId === reward.id
                              ? 'border-brand-primary bg-brand-primary/10'
                              : 'border-white/10'
                          } ${!affordable ? 'opacity-40' : ''}`}
                        >
                          <input
                            type="radio"
                            name="reward"
                            disabled={!affordable}
                            checked={selectedRewardId === reward.id}
                            onChange={() => setSelectedRewardId(reward.id)}
                            className="accent-brand-primary"
                          />
                          <span className="flex-1">
                            {reward.name}
                            {reward.menuItem ? ` (${reward.menuItem.name})` : ''}
                          </span>
                          <span className="font-mono text-brand-primary">
                            {reward.pointsCost} pts
                          </span>
                        </label>
                      );
                    })}
                    {selectedRewardId ? (
                      <button
                        type="button"
                        className="text-xs text-text-muted underline"
                        onClick={() => setSelectedRewardId('')}
                      >
                        Clear reward
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {orderMode !== 'dine-in' ? (
              <>
                <Input
                  label="Scheduled pickup (optional)"
                  type="datetime-local"
                  value={scheduledPickup}
                  onChange={(e) => setScheduledPickup(e.target.value)}
                />

                <Input
                  label="Tip (₹, optional)"
                  type="number"
                  min={0}
                  value={tipAmount || ''}
                  onChange={(e) => setTipAmount(Number(e.target.value) || 0)}
                />
              </>
            ) : null}

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
              <label className="mt-2 flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  checked={!payLater}
                  onChange={() => setPayLater(false)}
                  className="accent-brand-primary"
                />
                <span className="text-sm">Pay now (UPI / card)</span>
              </label>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-bg-elevated p-4">
              <span className="font-medium">Total due</span>
              <span className="text-xl font-semibold text-brand-primary">
                {formatPrice(dueTotal)}
              </span>
            </div>

            <Button
              type="submit"
              className="w-full"
              loading={placeOrderMutation.isPending}
              disabled={!outletId || !organizationId}
            >
              {payLater ? 'Place order · Pay later' : 'Place order & pay'}
            </Button>
          </form>
        )}
      </div>
    </CustomerLayout>
  );
}
