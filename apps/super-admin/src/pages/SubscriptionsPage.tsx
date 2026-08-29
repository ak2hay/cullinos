import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { superAdminApi } from '@/lib/api';

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [planSlug, setPlanSlug] = useState('enterprise');
  const [status, setStatus] = useState('ACTIVE');
  const [message, setMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'organizations', 1],
    queryFn: () => superAdminApi.listOrganizations(1, 50),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['super-admin', 'plans'],
    queryFn: () => superAdminApi.listPlans(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ orgId, planSlug: slug, status: s }: { orgId: string; planSlug: string; status: string }) =>
      superAdminApi.manageSubscription(orgId, { planSlug: slug, status: s }),
    onSuccess: () => {
      setMessage('Subscription updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const selected = data?.data.find((t) => t.id === selectedOrgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Subscription management</h1>
        <p className="mt-1 text-text-secondary">
          Update plan and subscription status for tenant organizations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">Select tenant</h2>
          <ul className="mt-4 max-h-96 divide-y divide-white/5 overflow-y-auto">
            {isLoading ? (
              <li className="py-4 text-sm text-text-muted">Loading…</li>
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
                  <dt className="text-text-muted">Users</dt>
                  <dd>{selected.userCount}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-text-muted">Created</dt>
                  <dd>{new Date(selected.createdAt).toLocaleDateString()}</dd>
                </div>
              </dl>

              <form
                className="space-y-4 border-t border-white/5 pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setMessage(null);
                  updateMutation.mutate({ orgId: selected.id, planSlug, status });
                }}
              >
                <h3 className="font-medium">Update subscription</h3>
                <label className="block">
                  <span className="text-sm text-text-secondary">Plan</span>
                  <select
                    value={planSlug}
                    onChange={(e) => setPlanSlug(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                  >
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.slug}>
                        {plan.name} ({plan.slug})
                      </option>
                    ))}
                    {plans.length === 0 ? (
                      <>
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                      </>
                    ) : null}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm text-text-secondary">Status</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="TRIAL">Trial</option>
                    <option value="PAST_DUE">Past due</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </label>
                {message ? (
                  <p className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm">
                    {message}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium hover:bg-brand-primary-dark disabled:opacity-60"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save subscription'}
                </button>
              </form>
            </div>
          ) : (
            <p className="mt-4 text-sm text-text-muted">Select a tenant to view details and manage subscription.</p>
          )}
        </section>
      </div>
    </div>
  );
}
