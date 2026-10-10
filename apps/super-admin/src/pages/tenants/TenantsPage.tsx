import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Pause, Play, Plus, Store, Trash2, Users } from 'lucide-react';
import { Button } from '@cullinos/ui';
import { inputClass, Notice } from '@/components/common';
import {
  ConfirmDialog,
  DataTable,
  EntityAvatar,
  FilterSelect,
  FilterTabs,
  KpiCard,
  KpiGrid,
  PageHeader,
  RowActions,
  SearchInput,
  StatusDot,
  StatusPill,
  type DataTableColumn,
  type PillTone,
} from '@/components/ui';
import { superAdminApi, type Tenant } from '@/lib/api';
import { formatDate, formatInr, percentChange, relativeTime } from '@/lib/format';
import { useCan } from '@/lib/permissions';
import { CredentialsDialog } from './CredentialsDialog';
import { OnboardTenantDrawer, type OnboardCredentials } from './OnboardTenantDrawer';

type StatusTab = '' | 'active' | 'trial' | 'suspended' | 'cancelled' | 'deleted';

const STATUS_OPTIONS: Array<{ value: StatusTab; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'deleted', label: 'Deleted' },
];

function billingInfo(t: Tenant): { tone: PillTone; label: string; detail?: string } {
  const sub = t.subscriptionStatus?.toLowerCase();
  if (!sub) return { tone: 'neutral', label: 'No subscription' };
  if (sub === 'trial') return { tone: 'info', label: 'Trial', detail: t.trialEndsAt ? `Ends ${formatDate(t.trialEndsAt)}` : undefined };
  if (sub === 'past_due' || t.graceUntil)
    return { tone: 'warning', label: 'Payment due', detail: t.graceUntil ? `Grace until ${formatDate(t.graceUntil)}` : undefined };
  if (sub === 'cancelled' || sub === 'expired') return { tone: 'neutral', label: 'Not renewing' };
  const next = t.currentPeriodEnd ? `Next: ${formatDate(t.currentPeriodEnd)}` : undefined;
  if (t.autoRenew) return { tone: 'success', label: 'Auto-renew', detail: next };
  return { tone: 'brand', label: 'Manual billing', detail: next };
}

export function TenantsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const can = useCan();
  const canOnboard = can('tenants.write');
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusTab>('');
  const [planFilter, setPlanFilter] = useState('');
  const [showOnboard, setShowOnboard] = useState(false);
  const [credentials, setCredentials] = useState<OnboardCredentials | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);
  const [reason, setReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);

  useEffect(() => {
    if (searchParams.get('onboard') === '1') {
      if (canOnboard) setShowOnboard(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, canOnboard]);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: plans = [] } = useQuery({ queryKey: ['super-admin', 'plans'], queryFn: () => superAdminApi.listPlans() });
  const summary = useQuery({ queryKey: ['super-admin', 'organizations', 'summary'], queryFn: superAdminApi.organizationSummary });
  const list = useQuery({
    queryKey: ['super-admin', 'organizations', page, pageSize, q, status, planFilter],
    queryFn: () =>
      superAdminApi.listOrganizations(page, pageSize, {
        q: q || undefined,
        status: status || undefined,
        planSlug: planFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });

  const suspend = useMutation({
    mutationFn: ({ id, reason: r }: { id: string; reason: string }) => superAdminApi.suspendOrganization(id, r),
    onSuccess: () => {
      setSuspendTarget(null);
      setReason('');
      invalidate();
    },
  });
  const activate = useMutation({ mutationFn: (id: string) => superAdminApi.activateOrganization(id), onSuccess: invalidate });
  const remove = useMutation({
    mutationFn: (id: string) => superAdminApi.deleteOrganization(id),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
  });

  function changeStatus(next: StatusTab) {
    setStatus(next);
    setPage(1);
  }

  const s = summary.data;
  const tenantGrowth = s ? percentChange(s.total, s.totalAtMonthStart) : null;
  const userGrowth = s ? percentChange(s.users, s.usersAtMonthStart) : null;
  const activeShare = s && s.total ? Math.round((s.active / s.total) * 100) : null;
  const dash = summary.isLoading ? '…' : '—';

  const columns: DataTableColumn<Tenant>[] = [
    {
      key: 'org',
      header: 'Organization',
      cell: (t) => (
        <div className="flex min-w-[14rem] items-center gap-3">
          <EntityAvatar name={t.name} seed={t.id} size={36} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-text-primary">{t.name}</p>
            <p className="truncate text-xs text-text-muted">{t.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      cell: (t) =>
        t.plan ? (
          <div>
            <p className="font-medium capitalize">{t.planName ?? t.plan}</p>
            <p className="text-xs text-text-muted">{formatInr(t.priceMonthly)} / month</p>
          </div>
        ) : (
          <div>
            <p className="text-text-muted">—</p>
            <p className="text-xs text-text-muted">No subscription</p>
          </div>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (t) => (status === 'deleted' ? <StatusPill status="deleted" /> : <StatusPill status={t.status ?? (t.isActive ? 'active' : 'suspended')} />),
    },
    { key: 'outlets', header: 'Outlets', className: 'text-center', cell: (t) => t.outletCount },
    { key: 'users', header: 'Users', className: 'text-center', cell: (t) => t.userCount },
    {
      key: 'billing',
      header: 'Billing',
      cell: (t) => {
        const b = billingInfo(t);
        return (
          <div className="whitespace-nowrap">
            <p className="flex items-center gap-2 text-sm">
              <StatusDot tone={b.tone} />
              {b.label}
            </p>
            {b.detail ? <p className="pl-4 text-xs text-text-muted">{b.detail}</p> : null}
          </div>
        );
      },
    },
    {
      key: 'created',
      header: 'Created',
      cell: (t) => (
        <div className="whitespace-nowrap">
          <p>{formatDate(t.createdAt)}</p>
          <p className="text-xs text-text-muted">{relativeTime(t.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      cell: (t) => {
        const active = t.isActive;
        return (
          <RowActions
            viewHref={`/tenants/${t.id}`}
            actions={[
              {
                label: 'Suspend',
                icon: Pause,
                hidden: status === 'deleted' || !can('tenants.suspend') || !active,
                onSelect: () => setSuspendTarget(t),
              },
              {
                label: 'Activate',
                icon: Play,
                hidden: status === 'deleted' || !can('tenants.suspend') || active,
                disabled: activate.isPending,
                onSelect: () => activate.mutate(t.id),
              },
              {
                label: 'Delete',
                icon: Trash2,
                danger: true,
                hidden: status === 'deleted' || !can('tenants.delete'),
                onSelect: () => setDeleteTarget(t),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Manage restaurant organizations, subscriptions and access."
        actions={
          canOnboard ? (
            <Button size="sm" onClick={() => setShowOnboard(true)} className="gap-2 px-4">
              <Plus size={16} aria-hidden="true" />
              Onboard restaurant
            </Button>
          ) : null
        }
      />

      <KpiGrid>
        <KpiCard
          label="Total Tenants"
          icon={Building2}
          tone="violet"
          value={s?.total ?? dash}
          trend={tenantGrowth != null ? { value: `${Math.abs(tenantGrowth)}%`, direction: tenantGrowth >= 0 ? 'up' : 'down' } : null}
          hint={s ? `+${s.newThisMonth} this month` : undefined}
        />
        <KpiCard
          label="Active Tenants"
          icon={Store}
          tone="green"
          value={s?.active ?? dash}
          trend={activeShare != null ? { value: `${activeShare}%` } : null}
          hint={s ? `${s.trial} trial account${s.trial === 1 ? '' : 's'}` : undefined}
        />
        <KpiCard
          label="Total Outlets"
          icon={Store}
          tone="orange"
          value={s?.outlets ?? dash}
          hint={s ? `From ${s.total} tenant${s.total === 1 ? '' : 's'}` : undefined}
        />
        <KpiCard
          label="Total Users"
          icon={Users}
          tone="blue"
          value={s?.users ?? dash}
          trend={userGrowth != null ? { value: `${Math.abs(userGrowth)}%`, direction: userGrowth >= 0 ? 'up' : 'down' } : null}
          hint="Staff accounts"
        />
      </KpiGrid>

      {list.error ? <Notice tone="error">{list.error instanceof Error ? list.error.message : 'Failed to load tenants'}</Notice> : null}

      <DataTable
        rows={list.data?.data ?? []}
        loading={list.isLoading}
        getRowKey={(t) => t.id}
        onRowClick={(t) => navigate(`/tenants/${t.id}`)}
        columns={columns}
        emptyMessage="No tenants match these filters"
        emptyDescription={q || status || planFilter ? 'Try clearing the search or filters.' : 'Onboard your first restaurant to get started.'}
        header={
          <FilterTabs<StatusTab>
            label="Tenant status"
            value={status === 'cancelled' ? '' : status}
            onChange={changeStatus}
            tabs={[
              { id: '', label: 'All Tenants', count: s?.total },
              { id: 'active', label: 'Active', count: s?.active },
              { id: 'trial', label: 'Trial', count: s?.trial },
              { id: 'suspended', label: 'Suspended', count: s?.suspended },
              { id: 'deleted', label: 'Deleted', count: s?.deleted },
            ]}
          />
        }
        toolbar={
          <>
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search name, slug, email…" className="sm:w-60" />
            <FilterSelect
              aria-label="Plan"
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
              options={[{ value: '', label: 'All plans' }, ...plans.map((p) => ({ value: p.slug, label: p.name }))]}
            />
            <FilterSelect
              aria-label="Status"
              value={status}
              onChange={(e) => changeStatus(e.target.value as StatusTab)}
              options={STATUS_OPTIONS}
            />
          </>
        }
        pagination={{
          page,
          pageSize,
          total: list.data?.meta.total ?? 0,
          onPageChange: setPage,
          onPageSizeChange: (n) => {
            setPageSize(n);
            setPage(1);
          },
          itemLabel: 'tenants',
        }}
      />

      <OnboardTenantDrawer
        open={showOnboard}
        onClose={() => setShowOnboard(false)}
        plans={plans}
        onCreated={(c) => {
          setShowOnboard(false);
          setCredentials(c);
        }}
      />
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        onClose={() => {
          setSuspendTarget(null);
          setReason('');
          suspend.reset();
        }}
        title={`Suspend ${suspendTarget?.name ?? 'tenant'}`}
        description="Owners and staff lose access immediately. You can re-activate later."
        confirmLabel="Suspend"
        tone="danger"
        loading={suspend.isPending}
        error={suspend.error}
        confirmDisabled={!reason.trim()}
        onConfirm={() => suspendTarget && suspend.mutate({ id: suspendTarget.id, reason })}
      >
        <label className="block text-sm">
          <span className="text-text-secondary">Reason</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className={`${inputClass} mt-1.5`}
            placeholder="Why is this tenant being suspended?"
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          remove.reset();
        }}
        title="Delete tenant"
        description={`${deleteTarget?.name ?? ''} will be cancelled and hidden from lists, and all of its users deactivated.`}
        confirmLabel="Delete tenant"
        tone="danger"
        loading={remove.isPending}
        error={remove.error}
        requireText={deleteTarget?.name}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </div>
  );
}
