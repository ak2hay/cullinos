import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@cullinos/ui';
import { openRazorpayCheckout } from '@/features/pos/razorpayCheckout';
import { subscriptionsApi, walletApi } from '@/lib/api';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

const TOP_UP_PRESETS = [500, 1000, 2500, 5000];

export function BillingPage() {
  const queryClient = useQueryClient();
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [topUpMessage, setTopUpMessage] = useState<string | null>(null);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState('');

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: subscriptionsApi.list,
  });

  const plansQuery = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: subscriptionsApi.plans,
  });

  const walletQuery = useQuery({
    queryKey: ['wallet'],
    queryFn: walletApi.get,
  });

  const ledgerQuery = useQuery({
    queryKey: ['wallet', 'ledger'],
    queryFn: () => walletApi.ledger(20),
  });

  const current = data[0];
  const trialExpired =
    current?.status === 'trial' &&
    current.trialEndsAt &&
    new Date(current.trialEndsAt).getTime() <= Date.now();

  const checkoutMutation = useMutation({
    mutationFn: subscriptionsApi.checkout,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'current'] });
      if (result.shortUrl) {
        window.open(result.shortUrl, '_blank', 'noopener,noreferrer');
      }
    },
  });

  const activateMutation = useMutation({
    mutationFn: (planSlug: string) => subscriptionsApi.activatePlan(planSlug),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'current'] });
      if (result.shortUrl) {
        window.open(result.shortUrl, '_blank', 'noopener,noreferrer');
      }
    },
  });

  async function handleTopUp(amountRupees: number) {
    setTopUpError(null);
    setTopUpMessage(null);
    try {
      const order = await walletApi.createTopUp(amountRupees);
      if (!order.keyId) throw new Error('Razorpay key is not configured');
      const result = await openRazorpayCheckout({
        key: order.keyId,
        amountPaise: order.amountPaise,
        currency: order.currency,
        razorpayOrderId: order.orderId,
        description: `Cullinos wallet top-up ₹${amountRupees}`,
      });
      const confirmed = await walletApi.confirmTopUp({
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      });
      setTopUpMessage(
        `Wallet credited. Balance ₹${confirmed.balanceRupees.toFixed(2)}.`,
      );
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    } catch (err) {
      setTopUpError(err instanceof Error ? err.message : 'Top-up failed');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Your Cullinos plan and prepaid portal wallet for paid addons (SMS campaigns).
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load subscription'}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : !current ? (
        <p className="text-sm text-text-muted">No subscription found. Contact support.</p>
      ) : (
        <section className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-text-muted">Plan</dt>
              <dd className="font-medium">{current.plan.name}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Status</dt>
              <dd className="capitalize">{current.status.replace('_', ' ')}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Trial ends</dt>
              <dd>{formatDate(current.trialEndsAt)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Current period end</dt>
              <dd>{formatDate(current.currentPeriodEnd)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Monthly</dt>
              <dd>₹{Number(current.plan.priceMonthly).toLocaleString('en-IN')}</dd>
            </div>
          </dl>

          {checkoutMutation.isError ? (
            <div className="space-y-1 rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
              <p>
                {checkoutMutation.error instanceof Error
                  ? checkoutMutation.error.message
                  : 'Could not start checkout'}
              </p>
              <p className="text-xs text-status-error/80">
                If this persists, confirm Razorpay keys are set for the platform and your
                organization has a valid email or phone.
              </p>
            </div>
          ) : null}

          {checkoutMutation.isSuccess && !checkoutMutation.data?.shortUrl ? (
            <p className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
              Checkout started but no payment link was returned. Refresh and try Open payment
              page, or contact support.
            </p>
          ) : null}

          {trialExpired || current.status === 'past_due' || current.status === 'trial' ? (
            <div className="space-y-3 rounded-lg border border-brand-primary/20 bg-brand-primary/5 p-4">
              <p className="text-sm font-medium text-brand-primary">
                {trialExpired
                  ? 'Your free trial has ended. Choose a plan and complete payment to keep using Cullinos.'
                  : 'Activate a paid plan when you are ready (or after the trial ends).'}
              </p>
              <label className="block text-sm">
                <span className="mb-1.5 block text-text-secondary">Select plan</span>
                <select
                  value={selectedPlanSlug || current.plan.slug}
                  onChange={(e) => setSelectedPlanSlug(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm"
                >
                  {(plansQuery.data ?? [current.plan]).map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name} — ₹{Number(p.priceMonthly).toLocaleString('en-IN')}/mo
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                loading={activateMutation.isPending}
                onClick={() =>
                  activateMutation.mutate(selectedPlanSlug || current.plan.slug)
                }
              >
                Pay &amp; activate selected plan
              </Button>
              {activateMutation.isError ? (
                <p className="text-sm text-status-error">
                  {activateMutation.error instanceof Error
                    ? activateMutation.error.message
                    : 'Activation failed'}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={checkoutMutation.isPending || current.status === 'cancelled'}
              onClick={() => checkoutMutation.mutate()}
            >
              {checkoutMutation.isPending ? 'Opening Razorpay…' : 'Pay / activate current plan'}
            </Button>
            {current.razorpayShortUrl ? (
              <a
                href={current.razorpayShortUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
              >
                Open payment page
              </a>
            ) : null}
          </div>
        </section>
      )}

      <section className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-6">
        <div>
          <h2 className="font-medium">Portal wallet</h2>
          <p className="text-sm text-text-muted">
            Spend on Cullinos SMS campaigns (paid addon). Charged only for messages actually sent.
          </p>
        </div>
        {walletQuery.isLoading ? (
          <p className="text-sm text-text-muted">Loading wallet…</p>
        ) : walletQuery.error ? (
          <p className="text-sm text-status-error">
            {walletQuery.error instanceof Error
              ? walletQuery.error.message
              : 'Failed to load wallet'}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-text-muted">Balance</dt>
                <dd className="text-xl font-semibold">
                  ₹{(walletQuery.data?.balanceRupees ?? 0).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">SMS rate</dt>
                <dd>
                  ₹{(walletQuery.data?.pricePer100Rupees ?? 0).toFixed(2)} / 100 SMS
                </dd>
              </div>
            </dl>
            {topUpError ? (
              <p className="text-sm text-status-error">{topUpError}</p>
            ) : null}
            {topUpMessage ? (
              <p className="text-sm text-status-success">{topUpMessage}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {TOP_UP_PRESETS.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="secondary"
                  onClick={() => void handleTopUp(amount)}
                >
                  Top up ₹{amount}
                </Button>
              ))}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-text-secondary">Recent activity</h3>
              {(ledgerQuery.data ?? []).length === 0 ? (
                <p className="text-xs text-text-muted">No wallet transactions yet.</p>
              ) : (
                <ul className="space-y-1 text-xs text-text-muted">
                  {(ledgerQuery.data ?? []).map((row) => (
                    <li key={row.id} className="flex justify-between gap-2">
                      <span>
                        {row.type.replace('_', ' ')}
                        {row.note ? ` · ${row.note}` : ''}
                      </span>
                      <span>
                        {row.amountPaise >= 0 ? '+' : ''}
                        ₹{(row.amountPaise / 100).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
