import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@cullinos/ui';
import { openRazorpaySubscriptionCheckout } from '@/features/billing/razorpaySubscriptionCheckout';
import { openRazorpayCheckout } from '@/features/pos/razorpayCheckout';
import { subscriptionsApi, walletApi } from '@/lib/api';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

const TOP_UP_PRESETS = [500, 1000, 2500, 5000];
const TOP_UP_MIN = 100;
const TOP_UP_MAX = 50_000;

export function BillingPage() {
  const queryClient = useQueryClient();
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [topUpMessage, setTopUpMessage] = useState<string | null>(null);
  const [customTopUp, setCustomTopUp] = useState('');
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

  async function openSubscriptionCheckout(result: {
    keyId: string | null;
    razorpaySubId: string | null;
    shortUrl: string | null;
    prefill?: { name?: string | null; email?: string | null; contact?: string | null };
  }) {
    if (result.keyId && result.razorpaySubId) {
      await openRazorpaySubscriptionCheckout({
        keyId: result.keyId,
        subscriptionId: result.razorpaySubId,
        description: 'Cullinos subscription',
        prefill: result.prefill,
      });
      return;
    }
    if (result.shortUrl) {
      window.open(result.shortUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    throw new Error('Checkout started but no payment method was returned');
  }

  const checkoutMutation = useMutation({
    mutationFn: subscriptionsApi.checkout,
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'current'] });
      await openSubscriptionCheckout(result);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (planSlug: string) => subscriptionsApi.activatePlan(planSlug),
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'current'] });
      await openSubscriptionCheckout(result);
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
          Your Cullinos plan and prepaid portal wallet for paid addons (SMS campaigns, WhatsApp receipts).
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
              <dd className="font-medium">
                {current.plan.name}
                {current.plan.visibility === 'private' ? (
                  <span className="ml-2 text-xs font-normal text-text-muted">(custom)</span>
                ) : null}
              </dd>
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
            {current.plan.maxOutlets != null ? (
              <div>
                <dt className="text-text-muted">Limits</dt>
                <dd>
                  {current.plan.maxOutlets} outlets
                  {current.plan.maxTerminals != null
                    ? ` · ${current.plan.maxTerminals} terminals`
                    : ''}
                </dd>
              </div>
            ) : null}
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

          {checkoutMutation.isSuccess &&
          !checkoutMutation.data?.keyId &&
          !checkoutMutation.data?.shortUrl ? (
            <p className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
              Checkout started but no payment method was returned. Refresh and try again, or
              contact support.
            </p>
          ) : null}

          {trialExpired || current.status === 'past_due' || current.status === 'trial' ? (
            <div className="space-y-3 rounded-lg border border-brand-primary/20 bg-brand-primary/5 p-4">
              <p className="text-sm font-medium text-brand-primary">
                {trialExpired
                  ? 'Your free trial has ended. Choose a plan and complete payment to keep using Cullinos.'
                  : 'Activate a paid plan when you are ready (or after the trial ends).'}
              </p>
              {current.plan.visibility === 'private' ? (
                <p className="text-sm text-text-secondary">
                  You are on a custom plan. Use &quot;Pay / activate current plan&quot; below, or
                  pick a public plan to switch.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {(plansQuery.data ?? []).map((p) => {
                  const selected = (selectedPlanSlug || plansQuery.data?.[0]?.slug) === p.slug;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setSelectedPlanSlug(p.slug)}
                      className={`rounded-lg border p-3 text-left text-sm transition ${
                        selected
                          ? 'border-brand-primary bg-brand-primary/10'
                          : 'border-white/10 bg-bg-elevated hover:border-white/20'
                      }`}
                    >
                      <p className="font-medium">{p.name}</p>
                      <p className="mt-0.5 text-text-secondary">
                        ₹{Number(p.priceMonthly).toLocaleString('en-IN')}/mo
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {p.maxOutlets} outlets
                        {p.maxTerminals != null ? ` · ${p.maxTerminals} terminals` : ''}
                      </p>
                      {p.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-text-muted">{p.description}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {(plansQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">No public plans available.</p>
              ) : (
                <Button
                  type="button"
                  loading={activateMutation.isPending}
                  disabled={!(selectedPlanSlug || plansQuery.data?.[0]?.slug)}
                  onClick={() =>
                    activateMutation.mutate(
                      selectedPlanSlug || plansQuery.data?.[0]?.slug || '',
                    )
                  }
                >
                  Pay &amp; activate selected plan
                </Button>
              )}
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
            Spend on Cullinos SMS campaigns and WhatsApp e-bills. Charged only for messages actually sent.
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
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
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
              <div>
                <dt className="text-text-muted">WhatsApp rate</dt>
                <dd>
                  ₹{(walletQuery.data?.whatsappPricePer100Rupees ?? 0).toFixed(2)} / 100 msgs
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
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
                <span className="text-text-muted">Custom amount (₹)</span>
                <input
                  type="number"
                  min={TOP_UP_MIN}
                  max={TOP_UP_MAX}
                  step={1}
                  inputMode="numeric"
                  placeholder={`${TOP_UP_MIN}–${TOP_UP_MAX}`}
                  value={customTopUp}
                  onChange={(e) => setCustomTopUp(e.target.value)}
                  className="h-10 rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
                />
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const amount = Math.floor(Number(customTopUp));
                  if (!Number.isFinite(amount) || amount < TOP_UP_MIN || amount > TOP_UP_MAX) {
                    setTopUpError(`Enter an amount between ₹${TOP_UP_MIN} and ₹${TOP_UP_MAX}`);
                    setTopUpMessage(null);
                    return;
                  }
                  void handleTopUp(amount);
                }}
              >
                Top up
              </Button>
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
