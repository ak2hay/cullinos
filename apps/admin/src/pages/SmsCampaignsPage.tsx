import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@cullinos/ui';
import { promoApi, walletApi } from '@/lib/api';

export function SmsCampaignsPage() {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ['promo', 'sms-recipients'],
    queryFn: promoApi.listSmsRecipients,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['promo', 'sms-campaigns'],
    queryFn: promoApi.listSmsCampaigns,
  });

  const withPhone = useMemo(
    () => recipients.filter((r) => !!r.phone),
    [recipients],
  );

  const recipientCount = selectAll ? withPhone.length : selectedIds.size;

  const walletQuery = useQuery({
    queryKey: ['wallet'],
    queryFn: walletApi.get,
  });

  const estimateQuery = useQuery({
    queryKey: ['wallet', 'sms-estimate', recipientCount],
    queryFn: () => walletApi.smsEstimate(recipientCount),
    enabled: recipientCount > 0,
  });

  const balanceRupees =
    estimateQuery.data?.balanceRupees ?? walletQuery.data?.balanceRupees ?? 0;
  const pricePer100Paise =
    estimateQuery.data?.pricePer100Paise ?? walletQuery.data?.pricePer100Paise ?? 0;
  const estimatePaise = estimateQuery.data?.estimatePaise ?? 0;
  const canAfford =
    recipientCount === 0
      ? true
      : (estimateQuery.data?.canAfford ??
        estimatePaise <= (walletQuery.data?.balancePaise ?? 0));

  const sendMutation = useMutation({
    mutationFn: promoApi.sendSmsCampaign,
    onSuccess: (result) => {
      setMessage(
        `Campaign ${result.status}: sent ${result.sentCount} of ${result.recipientCount}` +
          (result.failedCount ? ` (${result.failedCount} failed)` : '') +
          (result.chargedPaise
            ? ` · charged ₹${(result.chargedPaise / 100).toFixed(2)}`
            : ''),
      );
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['promo', 'sms-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  function toggleId(id: string) {
    setSelectAll(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const customerIds = selectAll ? undefined : [...selectedIds];
    if (!selectAll && (!customerIds || customerIds.length === 0)) {
      setError('Select at least one recipient');
      return;
    }
    if (recipientCount > 0 && !canAfford) {
      setError('Insufficient wallet balance. Top up under Billing first.');
      return;
    }
    const estimateLabel =
      recipientCount > 0
        ? ` Estimated cost ≈ ₹${(estimatePaise / 100).toFixed(2)} (charged only for SMS sent).`
        : '';
    if (
      !window.confirm(
        `Send SMS to ${selectAll ? withPhone.length : customerIds!.length} opted-in customer(s)?${estimateLabel}`,
      )
    ) {
      return;
    }
    sendMutation.mutate({ body, customerIds });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">SMS campaigns</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Paid addon — promotional SMS to customers who opted in (DPDP). Charged from your
          Cullinos portal wallet for messages actually sent.
        </p>
      </div>

      <section className="rounded-xl border border-white/5 bg-bg-card p-4 text-sm">
        {walletQuery.isLoading && !estimateQuery.data ? (
          <p className="text-text-muted">Loading wallet…</p>
        ) : walletQuery.error && !estimateQuery.data ? (
          <p className="text-text-muted">
            Wallet unavailable.{' '}
            <Link to="/billing" className="underline">
              Open Billing
            </Link>
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p>
                Wallet balance <strong>₹{balanceRupees.toFixed(2)}</strong>
                {' · '}₹{(pricePer100Paise / 100).toFixed(2)} / 100 SMS
              </p>
              <p className="text-text-muted">
                Estimate for {recipientCount} recipients: ₹
                {(estimatePaise / 100).toFixed(2)}
                {!canAfford && recipientCount > 0 ? ' — insufficient balance' : ''}
              </p>
            </div>
            <Link
              to="/billing"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
            >
              Top up wallet
            </Link>
          </div>
        )}
      </section>

      {message ? (
        <div className="rounded-lg border border-white/10 bg-bg-card px-4 py-3 text-sm text-text-secondary">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSend} className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">Compose</h2>
          <label className="block">
            <span className="mb-1.5 block text-sm text-text-secondary">Message</span>
            <textarea
              required
              rows={6}
              maxLength={160}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
            />
          </label>
          <p className="text-xs text-text-muted">{body.length}/160 characters</p>
          <Button
            type="submit"
            loading={sendMutation.isPending}
            disabled={
              withPhone.length === 0 ||
              (recipientCount > 0 && !canAfford)
            }
          >
            Send campaign
          </Button>
        </section>

        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium">Recipients ({withPhone.length})</h2>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={(e) => {
                  setSelectAll(e.target.checked);
                  setSelectedIds(new Set());
                }}
              />
              All opted-in
            </label>
          </div>
          {isLoading ? (
            <p className="mt-4 text-text-muted">Loading…</p>
          ) : (
            <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto text-sm">
              {withPhone.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  {!selectAll ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleId(r.id)}
                    />
                  ) : null}
                  <span>
                    {r.name} · {r.phone}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </form>

      <section className="rounded-xl border border-white/5 bg-bg-card p-6">
        <h2 className="font-medium">Recent campaigns</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {campaigns.map((c) => (
            <li key={c.id} className="border-b border-white/5 pb-3 last:border-0">
              <p className="font-medium capitalize">{c.status}</p>
              <p className="text-text-muted">
                {c.sentCount}/{c.recipientCount} sent
                {c.failedCount ? ` · ${c.failedCount} failed` : ''}
                {c.chargedPaise
                  ? ` · ₹${(c.chargedPaise / 100).toFixed(2)} charged`
                  : ''}
              </p>
              <p className="mt-1 line-clamp-2 text-text-secondary">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
