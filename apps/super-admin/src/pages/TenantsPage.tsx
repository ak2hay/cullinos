import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BUSINESS_TYPE_PARENT_LABELS,
  BUSINESS_TYPE_PARENTS,
  QSR_SUBTYPE_LABELS,
  QSR_SUBTYPES,
  RESTAURANT_SIZE_LABELS,
  RESTAURANT_SIZES,
  resolveBusinessTypeFromParent,
  type BusinessTypeParent,
  type QsrSubtype,
  type RestaurantSize,
} from '@cullinos/shared';
import { superAdminApi } from '@/lib/api';

type CredentialsResult = {
  ownerEmail: string;
  temporaryPassword: string;
  adminUrl: string;
  emailSent: boolean;
};

export function TenantsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [suspendId, setSuspendId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [deleteTenant, setDeleteTenant] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [showOnboard, setShowOnboard] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [outletName, setOutletName] = useState('Main Outlet');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [planSlug, setPlanSlug] = useState('professional');
  const [parentType, setParentType] = useState<BusinessTypeParent>('restaurant');
  const [qsrSubtype, setQsrSubtype] = useState<QsrSubtype>('cafe');
  const [restaurantSize, setRestaurantSize] = useState<RestaurantSize>('medium');
  const [credentials, setCredentials] = useState<CredentialsResult | null>(null);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  const businessType = useMemo(
    () => resolveBusinessTypeFromParent(parentType, qsrSubtype),
    [parentType, qsrSubtype],
  );

  useEffect(() => {
    if (searchParams.get('onboard') === '1') {
      setShowOnboard(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: plans = [] } = useQuery({
    queryKey: ['super-admin', 'plans'],
    queryFn: () => superAdminApi.listPlans(),
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['super-admin', 'organizations', page, q, statusFilter, planFilter],
    queryFn: () =>
      superAdminApi.listOrganizations(page, 20, {
        q: q || undefined,
        status: statusFilter || undefined,
        planSlug: planFilter || undefined,
      }),
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deleteOrganization(id),
    onSuccess: () => {
      setDeleteTenant(null);
      setDeleteConfirmName('');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
  });

  const onboardMutation = useMutation({
    mutationFn: superAdminApi.onboardRestaurant,
    onSuccess: (result) => {
      setCredentials({
        ownerEmail: result.ownerEmail,
        temporaryPassword: result.temporaryPassword,
        adminUrl: result.adminUrl,
        emailSent: result.emailSent,
      });
      setPasswordRevealed(false);
      setOnboardError(null);
      setShowOnboard(false);
      setCompanyName('');
      setOwnerEmail('');
      setOwnerName('');
      setParentType('restaurant');
      setQsrSubtype('cafe');
      setRestaurantSize('medium');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
    onError: (err: Error) => {
      setOnboardError(err.message);
      setCredentials(null);
    },
  });

  async function copyText(label: string, value: string, options?: { clearAfterMs?: number }) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 1500);
      if (options?.clearAfterMs) {
        window.setTimeout(() => {
          void navigator.clipboard.writeText('').catch(() => undefined);
        }, options.clearAfterMs);
      }
    } catch {
      // ignore
    }
  }

  function dismissCredentials() {
    setCredentials(null);
    setPasswordRevealed(false);
    setCopiedField(null);
  }

  function handleParentChange(next: BusinessTypeParent) {
    setParentType(next);
    if (next === 'qsr') setQsrSubtype('cafe');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tenants</h1>
          <p className="mt-1 text-text-secondary">
            Onboard restaurants and issue one-time owner credentials. Staff accounts are created by
            the owner in Admin.
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

      {credentials ? (
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-4 text-sm">
          <p className="font-medium text-status-success">Restaurant onboarded</p>
          <p className="mt-1 text-text-secondary">
            Share these credentials once. The owner must change the password on first login.
            {credentials.emailSent
              ? ' Credentials were also emailed to the owner.'
              : ' Email was not sent (check RESEND_API_KEY); copy credentials below.'}
            {' '}Temporary password is hidden by default; clipboard is cleared shortly after copy.
          </p>
          <div className="mt-3 space-y-2 font-mono text-xs text-text-primary">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-text-muted">Email:</span>
              <span>{credentials.ownerEmail}</span>
              <button
                type="button"
                onClick={() => copyText('email', credentials.ownerEmail)}
                className="rounded border border-white/10 px-2 py-0.5 text-[11px] hover:bg-white/5"
              >
                {copiedField === 'email' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-text-muted">Temp password:</span>
              <span>
                {passwordRevealed
                  ? credentials.temporaryPassword
                  : '•'.repeat(Math.max(12, credentials.temporaryPassword.length))}
              </span>
              <button
                type="button"
                onClick={() => setPasswordRevealed((v) => !v)}
                className="rounded border border-white/10 px-2 py-0.5 text-[11px] hover:bg-white/5"
              >
                {passwordRevealed ? 'Hide' : 'Reveal once'}
              </button>
              <button
                type="button"
                onClick={() =>
                  copyText('password', credentials.temporaryPassword, { clearAfterMs: 30_000 })
                }
                className="rounded border border-white/10 px-2 py-0.5 text-[11px] hover:bg-white/5"
              >
                {copiedField === 'password' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-text-muted">Admin URL:</span>
              <span>{credentials.adminUrl}</span>
              <button
                type="button"
                onClick={() => copyText('url', credentials.adminUrl)}
                className="rounded border border-white/10 px-2 py-0.5 text-[11px] hover:bg-white/5"
              >
                {copiedField === 'url' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissCredentials}
            className="mt-3 text-xs text-text-muted hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load tenants'}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name, slug, email…"
          className="min-w-[14rem] flex-1 rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">All plans</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.slug}>
              {plan.name}
            </option>
          ))}
        </select>
      </div>

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
            ) : (data?.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  No tenants match these filters.
                </td>
              </tr>
            ) : (
              (data?.data ?? []).map((tenant) => (
                <tr key={tenant.id} className="border-b border-white/5">
                  <td className="px-4 py-3">
                    <Link
                      to={`/tenants/${tenant.id}`}
                      className="font-medium hover:text-brand-primary"
                    >
                      {tenant.name}
                    </Link>
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
                    <div className="flex flex-wrap gap-3">
                      <Link
                        to={`/tenants/${tenant.id}`}
                        className="text-xs text-brand-primary hover:underline"
                      >
                        Open
                      </Link>
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
                      <button
                        type="button"
                        onClick={() => setDeleteTenant({ id: tenant.id, name: tenant.name })}
                        className="text-xs text-status-error hover:underline"
                      >
                        Delete
                      </button>
                    </div>
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

      {deleteTenant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-status-error/30 bg-bg-secondary p-6">
            <h2 className="text-lg font-medium text-status-error">Delete tenant</h2>
            <p className="mt-1 text-sm text-text-secondary">
              This permanently deletes <strong>{deleteTenant.name}</strong> and all related data.
              Type the organization name to confirm.
            </p>
            <input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              className="mt-4 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-brand-accent"
              placeholder={deleteTenant.name}
            />
            {deleteMutation.error ? (
              <p className="mt-2 text-sm text-status-error">
                {deleteMutation.error instanceof Error
                  ? deleteMutation.error.message
                  : 'Delete failed'}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTenant(null);
                  setDeleteConfirmName('');
                }}
                className="rounded-lg px-4 py-2 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deleteConfirmName !== deleteTenant.name || deleteMutation.isPending
                }
                onClick={() => deleteMutation.mutate(deleteTenant.id)}
                className="rounded-lg bg-status-error px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete forever'}
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
              Creates the tenant, default outlet, subscription, and a one-time owner password
              (shown once and emailed).
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
                  planSlug,
                  businessType,
                  ...(parentType === 'restaurant'
                    ? { restaurantSize }
                    : { restaurantSize: null }),
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
                <span className="text-sm text-text-secondary">Business category</span>
                <select
                  value={parentType}
                  onChange={(e) => handleParentChange(e.target.value as BusinessTypeParent)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                >
                  {BUSINESS_TYPE_PARENTS.map((parent) => (
                    <option key={parent} value={parent}>
                      {BUSINESS_TYPE_PARENT_LABELS[parent]}
                    </option>
                  ))}
                </select>
              </label>
              {parentType === 'restaurant' ? (
                <label className="block">
                  <span className="text-sm text-text-secondary">Restaurant size</span>
                  <select
                    value={restaurantSize}
                    onChange={(e) => setRestaurantSize(e.target.value as RestaurantSize)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                  >
                    {RESTAURANT_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {RESTAURANT_SIZE_LABELS[size]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {parentType === 'qsr' ? (
                <label className="block">
                  <span className="text-sm text-text-secondary">QSR subcategory</span>
                  <select
                    value={qsrSubtype}
                    onChange={(e) => setQsrSubtype(e.target.value as QsrSubtype)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                  >
                    {QSR_SUBTYPES.map((sub) => (
                      <option key={sub} value={sub}>
                        {QSR_SUBTYPE_LABELS[sub]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
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
                  {(plans.length
                    ? plans
                    : [{ slug: 'starter' }, { slug: 'professional' }, { slug: 'enterprise' }]
                  ).map((plan) => (
                    <option key={plan.slug} value={plan.slug}>
                      {plan.slug}
                    </option>
                  ))}
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
                  Must be unique — do not use your platform admin email. A one-time password is
                  generated automatically.
                </span>
              </label>
              {onboardError ? <p className="text-sm text-status-error">{onboardError}</p> : null}
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
