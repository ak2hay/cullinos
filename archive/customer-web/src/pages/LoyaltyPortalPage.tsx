import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@cullinos/ui';
import { CustomerLoginModal } from '@/components/CustomerLoginModal';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { useStorefrontBase } from '@/hooks/useStorefrontBase';
import { customerAuthApi, loyaltyApi } from '@/lib/api';
import { useCustomerAuthStore } from '@/stores/customerAuth';
import { useSessionStore } from '@/stores/session';

const TX_LABELS: Record<string, string> = {
  earn: 'Earned',
  redeem: 'Redeemed',
  redeem_reward: 'Reward',
  stamp: 'Stamp',
  stamp_reward: 'Stamp bonus',
};

function formatTxDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function LoyaltyPortalPage() {
  const base = useStorefrontBase();
  const organizationId = useSessionStore((s) => s.organizationId);
  const accessToken = useCustomerAuthStore((s) => s.accessToken);
  const customer = useCustomerAuthStore((s) => s.customer);
  const updateCustomer = useCustomerAuthStore((s) => s.updateCustomer);
  const logout = useCustomerAuthStore((s) => s.logout);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    customerAuthApi
      .me(accessToken)
      .then((profile) => {
        if (cancelled) return;
        updateCustomer({
          loyaltyPoints: profile.loyaltyPoints,
          stampCount: profile.stampCount,
          name: profile.name,
          phone: profile.phone,
        });
      })
      .catch(() => {
        if (!cancelled) logout();
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, updateCustomer, logout]);

  const portalQuery = useQuery({
    queryKey: ['loyalty-portal', organizationId, accessToken],
    queryFn: () => loyaltyApi.getMe(organizationId!, accessToken!),
    enabled: Boolean(organizationId && accessToken),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!portalQuery.data) return;
    updateCustomer({
      loyaltyPoints: portalQuery.data.loyaltyPoints,
      stampCount: portalQuery.data.stampCount,
      name: portalQuery.data.customer.name,
      phone: portalQuery.data.customer.phone,
    });
  }, [portalQuery.data, updateCustomer]);

  const settings = portalQuery.data?.settings;
  const stamps = portalQuery.data?.stampCount ?? customer?.stampCount ?? 0;
  const points = portalQuery.data?.loyaltyPoints ?? customer?.loyaltyPoints ?? 0;
  const stampEnabled = settings?.stampCardEnabled ?? true;

  return (
    <CustomerLayout showCart={false}>
      <div className="p-4">
        <Link to={base} className="mb-4 inline-block text-sm text-brand-primary">
          ← Back to menu
        </Link>

        <h1 className="mb-1 text-xl font-semibold">Loyalty</h1>
        <p className="mb-6 text-sm text-text-secondary">
          Sign in with your phone to view points and activity.
        </p>

        {!customer || !accessToken ? (
          <div className="rounded-xl border border-dashed border-white/20 p-6 text-center">
            <p className="text-text-secondary">
              View your loyalty points after signing in with a one-time code.
            </p>
            <Button className="mt-4" onClick={() => setLoginOpen(true)}>
              Sign in with phone
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-xl border border-white/10 bg-bg-card p-5">
              <p className="text-sm text-text-secondary">{customer.name}</p>
              <p className="mt-1 text-3xl font-semibold text-brand-primary">
                {points}
                <span className="ml-2 text-base font-medium text-text-secondary">
                  points
                </span>
              </p>
              {settings ? (
                <p className="mt-2 text-xs text-text-muted">
                  Earn {settings.pointsPerCurrency} pt per ₹1 · Min redeem{' '}
                  {settings.minRedeem} pts · ₹{settings.redemptionValue.toFixed(2)} per
                  point
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={`${base}/checkout`}
                  className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-bg-primary"
                >
                  Redeem at checkout
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="rounded-lg bg-bg-elevated px-3 py-2 text-sm text-text-secondary"
                >
                  Sign out
                </button>
              </div>
            </section>

            {stampEnabled ? (
              <section className="rounded-xl border border-white/10 bg-bg-card p-5">
                <h2 className="font-medium">Stamp card</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {stamps} of 10 stamps · complete a card for +100 points
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span
                      key={i}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                        i < stamps
                          ? 'bg-brand-primary text-bg-primary'
                          : 'bg-bg-elevated text-text-muted'
                      }`}
                    >
                      {i + 1}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="mb-3 font-medium">Recent activity</h2>
              {portalQuery.isLoading ? (
                <p className="text-sm text-text-secondary">Loading…</p>
              ) : portalQuery.isError ? (
                <p className="text-sm text-status-error">
                  Could not load activity. Try signing in again.
                </p>
              ) : (portalQuery.data?.recentTransactions.length ?? 0) === 0 ? (
                <p className="rounded-xl border border-dashed border-white/20 p-6 text-center text-sm text-text-secondary">
                  No loyalty activity yet. Points appear after completed orders.
                </p>
              ) : (
                <ul className="space-y-2">
                  {portalQuery.data!.recentTransactions.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-bg-card px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {TX_LABELS[tx.type] ?? tx.type}
                        </p>
                        <p className="text-xs text-text-muted">
                          {formatTxDate(tx.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-semibold ${
                          tx.points >= 0 ? 'text-status-success' : 'text-status-error'
                        }`}
                      >
                        {tx.points > 0 ? `+${tx.points}` : tx.points}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>

      <CustomerLoginModal
        open={loginOpen}
        orgId={organizationId}
        onClose={() => setLoginOpen(false)}
        title="Sign in to view loyalty"
        onSuccess={() => setLoginOpen(false)}
      />
    </CustomerLayout>
  );
}
