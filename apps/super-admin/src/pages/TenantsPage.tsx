import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { superAdminApi } from '@/lib/api';

export function TenantsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [suspendId, setSuspendId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [showOnboard, setShowOnboard] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [outletName, setOutletName] = useState('Main Outlet');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [planSlug, setPlanSlug] = useState('professional');
  const [onboardResult, setOnboardResult] = useState<string | null>(null);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  const { data: plans = [] } = useQuery({
    queryKey: ['super-admin', 'plans'],
    queryFn: () => superAdminApi.listPlans(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['super-admin', 'organizations', page],
    queryFn: () => superAdminApi.listOrganizations(page),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason: r }: { id: string; reason: string }) =>
      superAdminApi.suspendOrganization(id, r),
    onSuccess: () => {
      setSuspendId(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.activateOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
  });

  const onboardMutation = useMutation({
    mutationFn: superAdminApi.onboardRestaurant,
    onSuccess: (result) => {
      setOnboardResult(
        `Restaurant onboarded. Share owner login with ${result.ownerEmail} — Admin: ${result.adminUrl}`,
      );
      setOnboardError(null);
      setShowOnboard(false);
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
    onError: (err: Error) => {
      setOnboardError(err.message);
      setOnboardResult(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tenants</h1>
          <p className="mt-1 text-text-secondary">
            Onboard restaurants and issue owner credentials. Staff accounts are created by the
            owner in Admin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowOnboard(true)}
          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-bg-primary hover:bg-brand-primary-dark"
        >
          Onboard restaurant
        </button>
      </div>

      {onboardResult ? (
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {onboardResult}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load tenants'}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Outlets</th>
              <th className="px-4 py-3 font-medium">Users</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  Loading tenants…
                </td>
              </tr>
            ) : (
              (data?.data ?? []).map((tenant) => (
                <tr key={tenant.id} className="border-b border-white/5">
                  <td className="px-4 py-3">
                    <p className="font-medium">{tenant.name}</p>
                    <p className="text-xs text-text-muted">{tenant.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{tenant.plan ?? '—'}</p>
                    <p className="text-xs capitalize text-text-muted">
                      {tenant.subscriptionStatus?.toLowerCase() ?? 'no subscription'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        tenant.isActive
                          ? 'bg-status-success/15 text-status-success'
                          : 'bg-status-error/15 text-status-error'
                      }`}
                    >
                      {tenant.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{tenant.outletCount}</td>
                  <td className="px-4 py-3">{tenant.userCount}</td>
                  <td className="px-4 py-3">
                    {tenant.isActive ? (
                      <button
                        type="button"
                        onClick={() => setSuspendId(tenant.id)}
                        className="text-xs text-status-warning hover:underline"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => activateMutation.mutate(tenant.id)}
                        disabled={activateMutation.isPending}
                        className="text-xs text-status-success hover:underline"
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data?.meta.hasMore ? (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
        >
          Load more
        </button>
      ) : null}

      {suspendId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-bg-secondary p-6">
            <h2 className="text-lg font-medium">Suspend organization</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Provide a reason for suspension. Users will lose access immediately.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-4 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-brand-accent"
              placeholder="Reason for suspension"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSuspendId(null)}
                className="rounded-lg px-4 py-2 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reason.trim() || suspendMutation.isPending}
                onClick={() => suspendMutation.mutate({ id: suspendId, reason })}
                className="rounded-lg bg-status-error px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showOnboard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-bg-secondary p-6">
            <h2 className="text-lg font-medium">Onboard restaurant</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Creates the tenant, default outlet, subscription, and owner login for Admin.
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                onboardMutation.mutate({
                  companyName,
                  outletName,
                  ownerName: ownerName || undefined,
                  ownerEmail,
                  ownerPassword,
                  planSlug,
                });
              }}
            >
              <label className="block">
                <span className="text-sm text-text-secondary">Restaurant name</span>
                <input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                />
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">First outlet name</span>
                <input
                  required
                  value={outletName}
                  onChange={(e) => setOutletName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                />
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">Plan</span>
                <select
                  value={planSlug}
                  onChange={(e) => setPlanSlug(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                >
                  {(plans.length ? plans : [{ slug: 'starter' }, { slug: 'professional' }, { slug: 'enterprise' }]).map(
                    (plan) => (
                      <option key={plan.slug} value={plan.slug}>
                        {plan.slug}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">Owner name</span>
                <input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                />
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">Owner email (Admin login)</span>
                <input
                  type="email"
                  required
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                />
                <span className="mt-1 block text-xs text-text-muted">
                  Must be unique — do not use your platform admin email.
                </span>
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">Owner temporary password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                />
              </label>
              {onboardError ? (
                <p className="text-sm text-status-error">{onboardError}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOnboard(false)}
                  className="rounded-lg px-4 py-2 text-sm hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboardMutation.isPending}
                  className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-bg-primary disabled:opacity-60"
                >
                  {onboardMutation.isPending ? 'Creating…' : 'Create tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
