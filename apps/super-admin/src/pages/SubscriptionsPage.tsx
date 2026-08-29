import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { superAdminApi } from '@/lib/api';

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [planId, setPlanId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [message, setMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'organizations', 1],
    queryFn: () => superAdminApi.listOrganizations(1, 50),
  });

  const updateMutation = useMutation({
    mutationFn: ({ orgId, planId: p, status: s }: { orgId: string; planId: string; status: string }) =>
      superAdminApi.manageSubscription(orgId, { planId: p, status: s }),
    onSuccess: () => {
      setMessage('Subscription updated successfully.');
      setSelectedOrgId(null);
      setPlanId('');
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
                    onClick={() => setSelectedOrgId(tenant.id)}
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
          <h2 className="font-medium">Update subscription</h2>
          {selected ? (
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setMessage(null);
                if (!planId) return;
                updateMutation.mutate({ orgId: selected.id, planId, status });
              }}
            >
              <p className="text-sm text-text-secondary">
                Managing: <span className="font-medium text-text-primary">{selected.name}</span>
              </p>
              <label className="block">
                <span className="text-sm text-text-secondary">Plan ID</span>
                <input
                  required
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  placeholder="UUID of plan from database"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                />
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
          ) : (
            <p className="mt-4 text-sm text-text-muted">Select a tenant to manage their subscription.</p>
          )}
        </section>
      </div>
    </div>
  );
}
