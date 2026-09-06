import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { superAdminApi } from '@/lib/api';

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [planSlug, setPlanSlug] = useState('enterprise');
  const [status, setStatus] = useState('ACTIVE');
  const [message, setMessage] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'organizations', 'subs', q],
    queryFn: () => superAdminApi.listOrganizations(1, 100, { q: q || undefined }),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['super-admin', 'plans'],
    queryFn: () => superAdminApi.listPlans(),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      orgId,
      planSlug: slug,
      status: s,
    }: {
      orgId: string;
      planSlug: string;
      status: string;
    }) => superAdminApi.manageSubscription(orgId, { planSlug: slug, status: s }),
    onSuccess: () => {
      setMessage('Subscription updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const collectMutation = useMutation({
    mutationFn: (orgId: string) => superAdminApi.collectSubscription(orgId),
    onSuccess: (result) => {
      setMessage(
        result.shortUrl
          ? `Razorpay checkout ready: ${result.shortUrl}`
          : 'Razorpay subscription created.',
      );
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
      if (result.shortUrl) {
        window.open(result.shortUrl, '_blank', 'noopener,noreferrer');
      }
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const selected = data?.data.find((t) => t.id === selectedOrgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Subscription management</h1>
        <p className="mt-1 text-text-secondary">
          Search tenants, update plans, and collect Razorpay payments.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl border border-white/10 bg-bg-card px-4 py-3 text-sm text-text-secondary">
          {message}
          <button type="button" className="ml-3 text-xs underline" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">Select tenant</h2>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, slug, email…"
            className="mt-3 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
          <ul className="mt-4 max-h-96 divide-y divide-white/5 overflow-y-auto">
            {isLoading ? (
              <li className="py-4 text-sm text-text-muted">Loading…</li>
            ) : (data?.data ?? []).length === 0 ? (
              <li className="py-4 text-sm text-text-muted">No tenants found.</li>
            ) : (
              (data?.data ?? []).map((tenant) => (
                <li key={tenant.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrgId(tenant.id);
                      setPlanSlug(tenant.plan ?? 'enterprise');
                      setStatus(tenant.subscriptionStatus?.toUpperCase() ?? 'ACTIVE');
                    }}
                    className={`w-full px-2 py-3 text-left text-sm transition hover:bg-white/5 ${
                      selectedOrgId === tenant.id ? 'bg-white/5' : ''
                    }`}
                  >
                    <p className="font-medium">{tenant.name}</p>
                    <p className="text-xs text-text-muted">
                      {tenant.plan ?? 'No plan'} · {tenant.subscriptionStatus ?? '—'}
                      {tenant.mrrContribution
                        ? ` · ₹${tenant.mrrContribution}/mo`
                        : ''}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">Tenant detail</h2>
          {selected ? (
            <div className="mt-4 space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-text-muted">Slug</dt>
                  <dd className="font-mono">{selected.slug}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Status</dt>
                  <dd>{selected.isActive ? 'Active' : 'Suspended'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Outlets</dt>
                  <dd>{selected.outletCount}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">MRR contribution</dt>
                  <dd>₹{selected.mrrContribution ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Grace until</dt>
                  <dd>
                    {selected.graceUntil
                      ? new Date(selected.graceUntil).toLocaleDateString()
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Last payment id</dt>
                  <dd className="truncate font-mono text-xs">
                    {selected.lastRazorpayPaymentId ?? '—'}
                  </dd>
                </div>
              </dl>

              <Link
                to={`/tenants/${selected.id}`}
                className="inline-block text-sm text-brand-primary hover:underline"
              >
                Open tenant detail →
              </Link>

              <label className="block text-sm">
                <span className="text-text-muted">Plan</span>
                <select
                  value={planSlug}
                  onChange={(e) => setPlanSlug(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 outline-none focus:border-brand-accent"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.name} (₹{p.priceMonthly})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-text-muted">Subscription status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 outline-none focus:border-brand-accent"
                >
                  {['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      orgId: selected.id,
                      planSlug,
                      status,
                    })
                  }
                  className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-bg-primary disabled:opacity-60"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Update subscription'}
                </button>
                <button
                  type="button"
                  disabled={collectMutation.isPending}
                  onClick={() => collectMutation.mutate(selected.id)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
                >
                  {collectMutation.isPending ? 'Creating…' : 'Collect payment'}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-text-muted">Select a tenant to manage billing.</p>
          )}
        </section>
      </div>
    </div>
  );
}
