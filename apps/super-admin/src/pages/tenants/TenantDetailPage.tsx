import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CreditCard, ExternalLink, KeyRound, Pause, Play, ReceiptText, Store, UserCheck, UserX, Users, Wallet } from 'lucide-react';
import { Button } from '@cullinos/ui';
import { inputClass, Notice } from '@/components/common';
import {
  ActionMenu,
  ConfirmDialog,
  DataTable,
  DefinitionList,
  EntityAvatar,
  KpiCard,
  PageHeader,
  PageTabs,
  SectionCard,
  StatusPill,
} from '@/components/ui';
import { superAdminApi } from '@/lib/api';
import { formatDate, formatInr, relativeTime } from '@/lib/format';
import { useCan } from '@/lib/permissions';
import { supportApi } from '@/lib/platform-api';
import { openRazorpaySubscriptionCheckout } from '@/lib/razorpay-subscription-checkout';

type Tab = 'overview' | 'outlets' | 'users' | 'subscription' | 'audit';
type OrgUser = { id: string; name: string; email: string; status: string; roles: Array<{ name: string; slug: string }> };

export function TenantDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const can = useCan();
  const canManageUsers = can('tenant_users.manage');
  const [tab, setTab] = useState<Tab>('overview');
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspend, setShowSuspend] = useState(false);
  const [userToSuspend, setUserToSuspend] = useState<OrgUser | null>(null);
  const [userSuspendReason, setUserSuspendReason] = useState('');
  const [resetResult, setResetResult] = useState<{ email: string; temporaryPassword: string; emailSent: boolean } | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [walletAmountRupees, setWalletAmountRupees] = useState('500');
  const [walletNote, setWalletNote] = useState('');
  const [walletError, setWalletError] = useState<string | null>(null);

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
  const walletQuery = useQuery({
    queryKey: ['super-admin', 'organization', id, 'wallet'],
    queryFn: () => superAdminApi.getOrganizationWallet(id),
    enabled: Boolean(id),
  });
  const myGrantsQuery = useQuery({
    queryKey: ['super-admin', 'access-grants', 'tenant', id],
    queryFn: () => supportApi.grants({ mine: true, status: 'active', organizationId: id }),
    enabled: Boolean(id) && can('tenants.impersonate'),
  });
  const activeGrant = myGrantsQuery.data?.find((g) => g.expiresAt && new Date(g.expiresAt) > new Date());

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'organization', id] });
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
  };
  const fail = (err: Error) => setMessage({ tone: 'error', text: err.message });

  const suspendMutation = useMutation({
    mutationFn: () => superAdminApi.suspendOrganization(id, suspendReason),
    onSuccess: () => {
      setShowSuspend(false);
      setSuspendReason('');
      invalidate();
    },
  });
  const activateMutation = useMutation({ mutationFn: () => superAdminApi.activateOrganization(id), onSuccess: invalidate });

  const collectMutation = useMutation({
    mutationFn: () => superAdminApi.collectSubscription(id),
    onSuccess: async (result) => {
      invalidate();
      if (result.keyId && result.razorpaySubId) {
        try {
          setMessage({ tone: 'info', text: 'Opening Razorpay Checkout…' });
          await openRazorpaySubscriptionCheckout({
            keyId: result.keyId,
            subscriptionId: result.razorpaySubId,
            description: 'Cullinos subscription',
            prefill: result.prefill,
          });
          setMessage({ tone: 'success', text: 'Payment submitted. Subscription will activate when Razorpay confirms.' });
        } catch (err) {
          setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Checkout failed' });
        }
        return;
      }
      if (result.shortUrl) {
        setMessage({ tone: 'info', text: `Checkout ready: ${result.shortUrl}` });
        window.open(result.shortUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      setMessage({ tone: 'error', text: 'Razorpay subscription created but no checkout method was returned.' });
    },
    onError: fail,
  });

  const resetMutation = useMutation({
    mutationFn: (userId: string) => superAdminApi.resetOrganizationUserPassword(id, userId),
    onSuccess: (result) => {
      setResetResult({ email: result.email, temporaryPassword: result.temporaryPassword, emailSent: result.emailSent });
      usersQuery.refetch();
    },
    onError: fail,
  });
  const deactivateUserMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) => superAdminApi.deactivateOrganizationUser(id, userId, reason),
    onSuccess: () => {
      setUserToSuspend(null);
      setUserSuspendReason('');
      setMessage({ tone: 'success', text: 'User suspended.' });
      usersQuery.refetch();
    },
  });
  const activateUserMutation = useMutation({
    mutationFn: (userId: string) => superAdminApi.activateOrganizationUser(id, userId),
    onSuccess: () => {
      setMessage({ tone: 'success', text: 'User activated.' });
      usersQuery.refetch();
    },
    onError: fail,
  });
  const impersonateMutation = useMutation({
    mutationFn: (grantId: string) => superAdminApi.impersonateOrganization(id, grantId),
    onSuccess: (result) => {
      window.open(result.adminUrl, '_blank', 'noopener,noreferrer');
      setMessage({
        tone: 'info',
        text: `Opened ${result.accessLevel === 'full' ? 'full' : 'read-only'} support session as ${result.user.email} (expires ${new Date(result.expiresAt).toLocaleString()}). Every action is logged with your employee ID.`,
      });
    },
    onError: fail,
  });
  const walletAdjustMutation = useMutation({
    mutationFn: (payload: { amountPaise: number; note: string }) => superAdminApi.adjustOrganizationWallet(id, payload),
    onSuccess: (bal) => {
      setWalletError(null);
      setWalletNote('');
      setMessage({ tone: 'success', text: `Wallet updated. Balance ₹${bal.balanceRupees.toFixed(2)}.` });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organization', id, 'wallet'] });
    },
    onError: (err: Error) => setWalletError(err.message),
  });

  function adjustWallet(sign: 1 | -1) {
    const rupees = Math.abs(Number(walletAmountRupees));
    if (!Number.isFinite(rupees) || rupees === 0) return setWalletError('Enter a positive amount in rupees.');
    if (!walletNote.trim()) return setWalletError('Note is required.');
    walletAdjustMutation.mutate({ amountPaise: sign * Math.round(rupees * 100), note: walletNote.trim() });
  }

  const org = detailQuery.data;

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="ui-skeleton h-16 w-80 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ui-skeleton h-24 rounded-xl" />
          ))}
        </div>
        <div className="ui-skeleton h-72 rounded-xl" />
      </div>
    );
  }

  if (detailQuery.error || !org) {
    return (
      <div className="space-y-4">
        <PageHeader title="Tenant" breadcrumbs={[{ label: 'Customers' }, { label: 'Tenants', to: '/tenants' }, { label: 'Not found' }]} />
        <Notice tone="error">{detailQuery.error instanceof Error ? detailQuery.error.message : 'Tenant not found'}</Notice>
      </div>
    );
  }

  const isActive = org.status === 'active' || org.status === 'trial';
  const sub = org.subscription;
  const users = (usersQuery.data ?? []) as OrgUser[];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Customers' }, { label: 'Tenants', to: '/tenants' }, { label: org.name }]}
        leading={<EntityAvatar name={org.name} seed={org.id} size={52} className="rounded-xl" />}
        title={org.name}
        meta={
          <>
            <StatusPill status={org.status} />
            <StatusPill status={org.environmentClass === 0 ? 'sandbox' : 'live'} label={org.environmentClass === 0 ? 'Sandbox' : 'Live'} tone={org.environmentClass === 0 ? 'warning' : 'success'} dot={false} />
          </>
        }
        description={
          <>
            {org.slug}
            {org.email ? ` · ${org.email}` : ''} · Created {formatDate(org.createdAt)}
          </>
        }
        actions={
          <>
            {can('tenants.impersonate') ? (
              activeGrant ? (
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => impersonateMutation.mutate(activeGrant.id)}
                  loading={impersonateMutation.isPending}
                  disabled={!isActive}
                  title={`${activeGrant.accessLevel.replace('_', '-')} access via ${activeGrant.ticketRef}`}
                >
                  <ExternalLink size={15} aria-hidden="true" />
                  Open as tenant ({activeGrant.accessLevel === 'full' ? 'full' : 'read-only'})
                </Button>
              ) : (
                <Link
                  to={`/support/tickets?organizationId=${id}&status=open_all`}
                  className="inline-flex h-9 items-center rounded-lg border border-line bg-bg-card px-3 text-sm font-medium hover:bg-hover"
                  title="Tenant access needs an approved grant on an open support ticket"
                >
                  Request access via ticket
                </Link>
              )
            ) : null}
            {can('subscriptions.manage') ? (
              <Button size="sm" variant="secondary" className="gap-2" onClick={() => collectMutation.mutate()} loading={collectMutation.isPending}>
                <CreditCard size={15} aria-hidden="true" />
                Collect payment
              </Button>
            ) : null}
            {can('tenants.suspend') ? (
              <ActionMenu
                actions={[
                  { label: 'Suspend tenant', icon: Pause, danger: true, hidden: !isActive, onSelect: () => setShowSuspend(true) },
                  { label: 'Activate tenant', icon: Play, hidden: isActive, disabled: activateMutation.isPending, onSelect: () => activateMutation.mutate() },
                ]}
              />
            ) : null}
          </>
        }
      />

      {message ? (
        <Notice tone={message.tone}>
          {message.text}
          <button type="button" className="ml-3 text-xs font-medium underline" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </Notice>
      ) : null}

      {resetResult ? (
        <Notice tone="success">
          <p className="font-medium">Password reset</p>
          <p className="mt-1 font-mono text-xs">
            {resetResult.email} · {resetResult.temporaryPassword}
            {resetResult.emailSent ? ' (emailed)' : ' (email not sent)'}
          </p>
          <button type="button" className="mt-2 text-xs font-medium underline" onClick={() => setResetResult(null)}>
            Dismiss
          </button>
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Outlets" icon={Store} tone="orange" value={org.counts.outlets} />
        <KpiCard label="Users" icon={Users} tone="blue" value={org.counts.users} />
        <KpiCard label="Orders" icon={ReceiptText} tone="green" value={org.counts.orders.toLocaleString('en-IN')} />
        <KpiCard
          label="Plan"
          icon={CreditCard}
          tone="indigo"
          value={<span className="capitalize">{sub?.planName ?? '—'}</span>}
          hint={sub ? `${formatInr(sub.priceMonthly)} / month · ${sub.status}` : 'No subscription'}
        />
      </div>

      <PageTabs<Tab>
        label="Tenant sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'outlets', label: 'Outlets', count: org.outlets.length },
          { id: 'users', label: 'Users', count: usersQuery.data?.length },
          { id: 'subscription', label: 'Subscription' },
          { id: 'audit', label: 'Audit', count: org.recentAudit.length },
        ]}
      />

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard title="Profile" className="lg:col-span-2">
            <DefinitionList
              items={[
                { label: 'Email', value: org.email ?? '—' },
                { label: 'Phone', value: org.phone ?? '—' },
                { label: 'Business type', value: <span className="capitalize">{org.businessType.replace(/_/g, ' ')}</span> },
                { label: 'Size', value: <span className="capitalize">{org.restaurantSize ?? '—'}</span> },
                { label: 'Location', value: [org.city, org.state, org.country].filter(Boolean).join(', ') || '—' },
                { label: 'Timezone / currency', value: `${org.timezone} · ${org.currency}` },
                { label: 'Environment', value: org.environmentClass === 0 ? 'Sandbox' : 'Live (OTP always required)' },
                { label: 'Created', value: `${formatDate(org.createdAt)} (${relativeTime(org.createdAt)})` },
              ]}
            />
          </SectionCard>

          <SectionCard title="Portal wallet" description="SMS add-on balance">
            {walletQuery.isLoading ? (
              <div className="ui-skeleton h-16 rounded-lg" />
            ) : walletQuery.error ? (
              <p className="text-sm text-status-error">{walletQuery.error instanceof Error ? walletQuery.error.message : 'Failed to load wallet'}</p>
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
                  <Wallet size={20} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display text-2xl font-semibold">₹{(walletQuery.data?.balanceRupees ?? 0).toFixed(2)}</p>
                  <p className="text-xs text-text-muted">₹{(walletQuery.data?.pricePer100Rupees ?? 0).toFixed(2)} per 100 SMS</p>
                </div>
              </div>
            )}
            {can('wallet.manage') ? (
              <div className="mt-4 space-y-3 border-t border-line-subtle pt-4">
                <div className="grid grid-cols-[7rem_1fr] gap-2">
                  <input
                    type="number"
                    step="0.01"
                    aria-label="Amount in rupees"
                    value={walletAmountRupees}
                    onChange={(e) => setWalletAmountRupees(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    aria-label="Note"
                    value={walletNote}
                    onChange={(e) => setWalletNote(e.target.value)}
                    placeholder="Note (required)"
                    className={inputClass}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" loading={walletAdjustMutation.isPending} onClick={() => adjustWallet(1)}>
                    Credit
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1" disabled={walletAdjustMutation.isPending} onClick={() => adjustWallet(-1)}>
                    Debit
                  </Button>
                </div>
                {walletError ? <p className="text-sm text-status-error">{walletError}</p> : null}
                <p className="text-xs text-text-muted">SMS rate is set under System Settings.</p>
              </div>
            ) : null}
          </SectionCard>
        </div>
      ) : null}

      {tab === 'outlets' ? (
        <DataTable
          rows={org.outlets}
          getRowKey={(o) => o.id}
          emptyMessage="No outlets"
          columns={[
            {
              key: 'name',
              header: 'Outlet',
              cell: (o) => (
                <div className="flex items-center gap-3">
                  <EntityAvatar name={o.name} seed={o.id} size={32} />
                  <div>
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-text-muted">{o.slug}</p>
                  </div>
                </div>
              ),
            },
            { key: 'status', header: 'Status', cell: (o) => <StatusPill status={o.status} /> },
          ]}
        />
      ) : null}

      {tab === 'users' ? (
        <DataTable
          rows={users}
          loading={usersQuery.isLoading}
          getRowKey={(u) => u.id}
          emptyMessage="No users"
          columns={[
            {
              key: 'name',
              header: 'Name',
              cell: (u) => (
                <div className="flex items-center gap-3">
                  <EntityAvatar name={u.name} seed={u.id} size={32} rounded="full" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-text-muted">{u.email}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'roles',
              header: 'Roles',
              cell: (u) =>
                u.roles.length ? (
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span key={r.slug} className="rounded-md bg-bg-elevated px-2 py-0.5 text-xs text-text-secondary">
                        {r.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  '—'
                ),
            },
            { key: 'status', header: 'Status', cell: (u) => <StatusPill status={u.status} /> },
            ...(canManageUsers
              ? [
                  {
                    key: 'actions',
                    header: '',
                    className: 'text-right',
                    cell: (u: OrgUser) => (
                      <ActionMenu
                        actions={[
                          { label: 'Reset password', icon: KeyRound, disabled: resetMutation.isPending, onSelect: () => resetMutation.mutate(u.id) },
                          {
                            label: 'Unsuspend',
                            icon: UserCheck,
                            hidden: u.status !== 'inactive',
                            disabled: activateUserMutation.isPending,
                            onSelect: () => activateUserMutation.mutate(u.id),
                          },
                          { label: 'Suspend', icon: UserX, danger: true, hidden: u.status === 'inactive', onSelect: () => setUserToSuspend(u) },
                        ]}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      {tab === 'subscription' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard title="Subscription" className="lg:col-span-2">
            {sub ? (
              <DefinitionList
                columns={3}
                items={[
                  { label: 'Plan', value: `${sub.planName} (${sub.planSlug})` },
                  { label: 'Status', value: <StatusPill status={sub.status} /> },
                  { label: 'Price / month', value: formatInr(sub.priceMonthly) },
                  { label: 'Trial ends', value: formatDate(sub.trialEndsAt) },
                  { label: 'Current period ends', value: formatDate(sub.currentPeriodEnd) },
                  { label: 'Grace until', value: formatDate(sub.graceUntil) },
                  { label: 'Razorpay subscription', value: <span className="font-mono text-xs">{sub.razorpaySubId ?? '—'}</span> },
                  { label: 'Last payment', value: <span className="font-mono text-xs">{sub.lastRazorpayPaymentId ?? '—'}</span> },
                ]}
              />
            ) : (
              <p className="text-sm text-text-muted">No subscription</p>
            )}
          </SectionCard>
          <SectionCard title="Entitlements" description="Modules on this plan">
            {sub?.entitlements.length ? (
              <ul className="space-y-1.5 text-sm">
                {sub.entitlements.map((e) => (
                  <li key={e.module} className="flex items-center justify-between gap-2">
                    <span className="capitalize">{e.module.replace(/_/g, ' ')}</span>
                    <StatusPill status={e.enabled ? 'enabled' : 'disabled'} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No entitlements</p>
            )}
          </SectionCard>
        </div>
      ) : null}

      {tab === 'audit' ? (
        <DataTable
          rows={org.recentAudit}
          getRowKey={(a) => a.id}
          emptyMessage="No audit entries yet"
          columns={[
            { key: 'action', header: 'Action', cell: (a) => <span className="rounded-md bg-bg-elevated px-2 py-0.5 font-mono text-xs">{a.action}</span> },
            {
              key: 'entity',
              header: 'Entity',
              cell: (a) => (
                <>
                  {a.entityType}
                  {a.entityId ? <span className="text-text-muted"> · {a.entityId.slice(0, 8)}</span> : null}
                </>
              ),
            },
            { key: 'user', header: 'User', cell: (a) => a.user?.email ?? '—' },
            {
              key: 'when',
              header: 'When',
              cell: (a) => (
                <span className="text-text-muted" title={new Date(a.createdAt).toLocaleString()}>
                  {relativeTime(a.createdAt)}
                </span>
              ),
            },
          ]}
        />
      ) : null}

      <ConfirmDialog
        open={showSuspend}
        onClose={() => {
          setShowSuspend(false);
          suspendMutation.reset();
        }}
        title={`Suspend ${org.name}`}
        description="Owners and staff lose access immediately. You can re-activate later."
        confirmLabel="Suspend"
        tone="danger"
        loading={suspendMutation.isPending}
        error={suspendMutation.error}
        confirmDisabled={!suspendReason.trim()}
        onConfirm={() => suspendMutation.mutate()}
      >
        <textarea
          value={suspendReason}
          onChange={(e) => setSuspendReason(e.target.value)}
          rows={3}
          aria-label="Reason for suspension"
          className={inputClass}
          placeholder="Reason for suspension"
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(userToSuspend)}
        onClose={() => {
          setUserToSuspend(null);
          setUserSuspendReason('');
          deactivateUserMutation.reset();
        }}
        title={`Suspend ${userToSuspend?.name ?? 'user'}`}
        description={
          userToSuspend?.roles.some((r) => r.slug === 'owner')
            ? 'This owner will not be able to sign in. Blocked if this is the last active owner.'
            : 'This user will not be able to sign in.'
        }
        confirmLabel="Suspend user"
        tone="danger"
        loading={deactivateUserMutation.isPending}
        error={deactivateUserMutation.error}
        onConfirm={() =>
          userToSuspend && deactivateUserMutation.mutate({ userId: userToSuspend.id, reason: userSuspendReason.trim() || undefined })
        }
      >
        <textarea
          value={userSuspendReason}
          onChange={(e) => setUserSuspendReason(e.target.value)}
          rows={2}
          aria-label="Suspend reason"
          className={inputClass}
          placeholder="Optional reason (shown in audit)"
        />
      </ConfirmDialog>
    </div>
  );
}
