import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { superAdminApi } from '@/lib/api';

export function TenantDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspend, setShowSuspend] = useState(false);
  const [resetResult, setResetResult] = useState<{
    email: string;
    temporaryPassword: string;
    emailSent: boolean;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ['super-admin', 'organization', id],
    queryFn: () => superAdminApi.getOrganization(id),
    enabled: Boolean(id),
  });

  const usersQuery = useQuery({
    queryKey: ['super-admin', 'organization', id, 'users'],
    queryFn: () => superAdminApi.listOrganizationUsers(id),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'organization', id] });
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
  };

  const suspendMutation = useMutation({
    mutationFn: () => superAdminApi.suspendOrganization(id, suspendReason),
    onSuccess: () => {
      setShowSuspend(false);
      setSuspendReason('');
      invalidate();
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => superAdminApi.activateOrganization(id),
    onSuccess: invalidate,
  });

  const collectMutation = useMutation({
    mutationFn: () => superAdminApi.collectSubscription(id),
    onSuccess: (result) => {
      setMessage(
        result.shortUrl
          ? `Checkout ready: ${result.shortUrl}`
          : 'Razorpay subscription created.',
      );
      if (result.shortUrl) window.open(result.shortUrl, '_blank', 'noopener,noreferrer');
      invalidate();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const resetMutation = useMutation({
    mutationFn: (userId: string) => superAdminApi.resetOrganizationUserPassword(id, userId),
    onSuccess: (result) => {
      setResetResult({
        email: result.email,
        temporaryPassword: result.temporaryPassword,
        emailSent: result.emailSent,
      });
      usersQuery.refetch();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const deactivateUserMutation = useMutation({
    mutationFn: (userId: string) => superAdminApi.deactivateOrganizationUser(id, userId),
    onSuccess: () => {
      setMessage('User deactivated.');
      usersQuery.refetch();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const activateUserMutation = useMutation({
    mutationFn: (userId: string) => superAdminApi.activateOrganizationUser(id, userId),
    onSuccess: () => {
      setMessage('User activated.');
      usersQuery.refetch();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const impersonateMutation = useMutation({
    mutationFn: () => superAdminApi.impersonateOrganization(id),
    onSuccess: (result) => {
      window.open(result.adminUrl, '_blank', 'noopener,noreferrer');
      setMessage(`Opened support session as ${result.user.email} (expires ${new Date(result.expiresAt).toLocaleString()})`);
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const org = detailQuery.data;

  if (detailQuery.isLoading) {
    return <p className="text-sm text-text-muted">Loading tenant…</p>;
  }

  if (detailQuery.error || !org) {
    return (
      <div className="space-y-4">
        <Link to="/tenants" className="text-sm text-brand-primary hover:underline">
          ← Tenants
        </Link>
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : 'Tenant not found'}
        </div>
      </div>
    );
  }

  const isActive = org.status === 'active' || org.status === 'trial';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/tenants" className="text-sm text-brand-primary hover:underline">
            ← Tenants
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{org.name}</h1>
          <p className="mt-1 text-text-secondary">
            {org.slug} · {org.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => impersonateMutation.mutate()}
            disabled={impersonateMutation.isPending || !isActive}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-bg-primary disabled:opacity-60"
          >
            {impersonateMutation.isPending ? 'Opening…' : 'Open as tenant'}
          </button>
          <button
            type="button"
            onClick={() => collectMutation.mutate()}
            disabled={collectMutation.isPending}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
          >
            Collect payment
          </button>
          {isActive ? (
            <button
              type="button"
              onClick={() => setShowSuspend(true)}
              className="rounded-lg border border-status-warning/40 px-4 py-2 text-sm text-status-warning hover:bg-status-warning/10"
            >
              Suspend
            </button>
          ) : (
            <button
              type="button"
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              className="rounded-lg border border-status-success/40 px-4 py-2 text-sm text-status-success hover:bg-status-success/10"
            >
              Activate
            </button>
          )}
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-white/10 bg-bg-card px-4 py-3 text-sm text-text-secondary">
          {message}
          <button type="button" className="ml-3 text-xs underline" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {resetResult ? (
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm">
          <p className="font-medium text-status-success">Password reset</p>
          <p className="mt-1 font-mono text-xs">
            {resetResult.email} · {resetResult.temporaryPassword}
            {resetResult.emailSent ? ' (emailed)' : ' (email not sent)'}
          </p>
          <button
            type="button"
            className="mt-2 text-xs underline"
            onClick={() => setResetResult(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-white/5 bg-bg-card p-5 lg:col-span-2">
          <h2 className="font-medium">Profile</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-text-muted">Email</dt>
              <dd>{org.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Phone</dt>
              <dd>{org.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Business type</dt>
              <dd className="capitalize">{org.businessType.replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Location</dt>
              <dd>
                {[org.city, org.state, org.country].filter(Boolean).join(', ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Timezone / currency</dt>
              <dd>
                {org.timezone} · {org.currency}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Created</dt>
              <dd>{new Date(org.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-white/5 bg-bg-card p-5">
          <h2 className="font-medium">Counts</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Users</dt>
              <dd className="font-medium">{org.counts.users}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Outlets</dt>
              <dd className="font-medium">{org.counts.outlets}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Orders</dt>
              <dd className="font-medium">{org.counts.orders}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="font-medium">Subscription</h2>
        {org.subscription ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-text-muted">Plan</dt>
              <dd>
                {org.subscription.planName} ({org.subscription.planSlug})
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Status</dt>
              <dd className="capitalize">{org.subscription.status}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Price / mo</dt>
              <dd>₹{org.subscription.priceMonthly}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Trial ends</dt>
              <dd>
                {org.subscription.trialEndsAt
                  ? new Date(org.subscription.trialEndsAt).toLocaleDateString()
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Grace until</dt>
              <dd>
                {org.subscription.graceUntil
                  ? new Date(org.subscription.graceUntil).toLocaleDateString()
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Last payment</dt>
              <dd className="font-mono text-xs">
                {org.subscription.lastRazorpayPaymentId ?? '—'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-text-muted">No subscription</p>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
        <div className="border-b border-white/5 px-4 py-3">
          <h2 className="font-medium">Users</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : (
              (usersQuery.data ?? []).map((user) => (
                <tr key={user.id} className="border-b border-white/5">
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-text-muted">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {user.roles.map((r) => r.name).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 capitalize">{user.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => resetMutation.mutate(user.id)}
                        disabled={resetMutation.isPending}
                        className="text-xs text-brand-primary hover:underline disabled:opacity-60"
                      >
                        Reset password
                      </button>
                      {user.status === 'inactive' ? (
                        <button
                          type="button"
                          onClick={() => activateUserMutation.mutate(user.id)}
                          disabled={activateUserMutation.isPending}
                          className="text-xs text-brand-primary hover:underline disabled:opacity-60"
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const isOwner = user.roles.some((r) => r.slug === 'owner');
                            const label = isOwner
                              ? `Deactivate owner "${user.name}"? They will not be able to sign in. (Blocked if this is the last active owner.)`
                              : `Deactivate "${user.name}"? They will not be able to sign in.`;
                            if (!window.confirm(label)) return;
                            deactivateUserMutation.mutate(user.id);
                          }}
                          disabled={deactivateUserMutation.isPending}
                          className="text-xs text-status-error hover:underline disabled:opacity-60"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
        <div className="border-b border-white/5 px-4 py-3">
          <h2 className="font-medium">Recent audit</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {org.recentAudit.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-text-muted">
                  No audit entries yet.
                </td>
              </tr>
            ) : (
              org.recentAudit.map((a) => (
                <tr key={a.id} className="border-b border-white/5">
                  <td className="px-4 py-3 font-mono text-xs">{a.action}</td>
                  <td className="px-4 py-3">
                    {a.entityType}
                    {a.entityId ? (
                      <span className="text-text-muted"> · {a.entityId.slice(0, 8)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{a.user?.email ?? '—'}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {showSuspend ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-bg-secondary p-6">
            <h2 className="text-lg font-medium">Suspend organization</h2>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
              className="mt-4 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-brand-accent"
              placeholder="Reason for suspension"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSuspend(false)}
                className="rounded-lg px-4 py-2 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!suspendReason.trim() || suspendMutation.isPending}
                onClick={() => suspendMutation.mutate()}
                className="rounded-lg bg-status-error px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
