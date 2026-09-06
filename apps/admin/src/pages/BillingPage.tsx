import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@cullinos/ui';
import { subscriptionsApi } from '@/lib/api';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export function BillingPage() {
  const queryClient = useQueryClient();

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: subscriptionsApi.list,
  });

  const current = data[0];

  const checkoutMutation = useMutation({
    mutationFn: subscriptionsApi.checkout,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      if (result.shortUrl) {
        window.open(result.shortUrl, '_blank', 'noopener,noreferrer');
      }
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Your Cullinos plan and subscription. Pay with Razorpay to activate after trial.
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
            <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
              {checkoutMutation.error instanceof Error
                ? checkoutMutation.error.message
                : 'Could not start checkout'}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={checkoutMutation.isPending || current.status === 'cancelled'}
              onClick={() => checkoutMutation.mutate()}
            >
              {checkoutMutation.isPending ? 'Opening Razorpay…' : 'Pay / activate'}
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
    </div>
  );
}
