import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, IndianRupee, Settings2 } from 'lucide-react';
import { Button } from '@cullinos/ui';
import { inputClass, LabeledInput, Notice } from '@/components/common';
import {
  DataTable,
  DefinitionList,
  EntityAvatar,
  FilterSelect,
  FormDrawer,
  KpiCard,
  KpiGrid,
  PageHeader,
  RowActions,
  SearchInput,
  StatusPill,
} from '@/components/ui';
import { superAdminApi, type Tenant } from '@/lib/api';
import { formatDate, formatInr } from '@/lib/format';
import { openRazorpaySubscriptionCheckout } from '@/lib/razorpay-subscription-checkout';

const SUB_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'];

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [planSlug, setPlanSlug] = useState('enterprise');
  const [status, setStatus] = useState('ACTIVE');
  const [message, setMessage] = useState<{ tone: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const list = useQuery({
    queryKey: ['super-admin', 'organizations', 'subs', page, pageSize, q, planFilter],
    queryFn: () => superAdminApi.listOrganizations(page, pageSize, { q: q || undefined, planSlug: planFilter || undefined }),
    placeholderData: keepPreviousData,
  });
  const analytics = useQuery({ queryKey: ['super-admin', 'analytics', '30d'], queryFn: () => superAdminApi.analyticsOverview('30d') });
  const { data: plans = [] } = useQuery({ queryKey: ['super-admin', 'plans'], queryFn: () => superAdminApi.listPlans() });

  const updateMutation = useMutation({
    mutationFn: ({ orgId, planSlug: slug, status: s }: { orgId: string; planSlug: string; status: string }) =>
      superAdminApi.manageSubscription(orgId, { planSlug: slug, status: s }),
    onSuccess: () => {
      setSelected(null);
      setMessage({ tone: 'success', text: 'Subscription updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
  });

  const collectMutation = useMutation({
    mutationFn: (orgId: string) => superAdminApi.collectSubscription(orgId),
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
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
        setMessage({ tone: 'info', text: `Razorpay checkout ready: ${result.shortUrl}` });
        window.open(result.shortUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      setMessage({ tone: 'error', text: 'Razorpay subscription created but no checkout method was returned.' });
    },
    onError: (err: Error) => setMessage({ tone: 'error', text: err.message }),
  });

  function openManage(t: Tenant) {
    setSelected(t);
    setPlanSlug(t.plan ?? 'enterprise');
    setStatus(t.subscriptionStatus?.toUpperCase() ?? 'ACTIVE');
    updateMutation.reset();
  }

  const saas = analytics.data?.saas;

  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" description="Update tenant plans and collect Razorpay payments for Cullinos SaaS billing." />

      <KpiGrid>
        <KpiCard label="MRR" icon={IndianRupee} tone="indigo" value={saas ? formatInr(saas.mrr) : '…'} hint="Monthly recurring revenue" />
        <KpiCard label="ARR" icon={IndianRupee} tone="violet" value={saas ? formatInr(saas.arr) : '…'} />
        <KpiCard label="Trials" icon={CreditCard} tone="blue" value={saas?.trialCount ?? '…'} hint={`${saas?.trialsEndingSoon.length ?? 0} ending this week`} />
        <KpiCard label="Cancelled (30d)" icon={CreditCard} tone="rose" value={saas?.cancelledInRange ?? '…'} />
      </KpiGrid>

      {message ? (
        <Notice tone={message.tone}>
          {message.text}
          <button type="button" className="ml-3 text-xs font-medium underline" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </Notice>
      ) : null}

      <DataTable
        rows={list.data?.data ?? []}
        loading={list.isLoading}
        getRowKey={(t) => t.id}
        onRowClick={openManage}
        emptyMessage="No tenants found"
        toolbar={
          <>
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search name, slug, email…" />
            <FilterSelect
              aria-label="Plan"
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
              options={[{ value: '', label: 'All plans' }, ...plans.map((p) => ({ value: p.slug, label: p.name }))]}
            />
          </>
        }
        columns={[
          {
            key: 'org',
            header: 'Organization',
            cell: (t) => (
              <div className="flex items-center gap-3">
                <EntityAvatar name={t.name} seed={t.id} size={34} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="truncate text-xs text-text-muted">{t.slug}</p>
                </div>
              </div>
            ),
          },
          { key: 'plan', header: 'Plan', cell: (t) => <span className="capitalize">{t.planName ?? t.plan ?? '—'}</span> },
          { key: 'sub', header: 'Subscription', cell: (t) => (t.subscriptionStatus ? <StatusPill status={t.subscriptionStatus.toLowerCase()} /> : <span className="text-text-muted">None</span>) },
          { key: 'mrr', header: 'MRR', className: 'tabular-nums', cell: (t) => formatInr(t.mrrContribution ?? 0) },
          {
            key: 'renews',
            header: 'Renews / ends',
            cell: (t) => (
              <span className="text-text-secondary">
                {t.subscriptionStatus?.toLowerCase() === 'trial' ? `Trial ends ${formatDate(t.trialEndsAt)}` : formatDate(t.currentPeriodEnd)}
              </span>
            ),
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            cell: (t) => (
              <RowActions
                onView={() => openManage(t)}
                viewLabel="Manage"
                actions={[{ label: 'Collect payment', icon: CreditCard, disabled: collectMutation.isPending, onSelect: () => collectMutation.mutate(t.id) }]}
              />
            ),
          },
        ]}
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

      <FormDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Manage ${selected.name}` : 'Manage subscription'}
        description="Plan and status changes may require approval."
        submitLabel="Update subscription"
        loading={updateMutation.isPending}
        error={updateMutation.error}
        onSubmit={() => selected && updateMutation.mutate({ orgId: selected.id, planSlug, status })}
        extraFooter={
          selected ? (
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="mr-auto gap-2"
              loading={collectMutation.isPending}
              onClick={() => collectMutation.mutate(selected.id)}
            >
              <CreditCard size={15} aria-hidden="true" />
              Collect payment
            </Button>
          ) : null
        }
      >
        {selected ? (
          <>
            <div className="rounded-xl border border-line-subtle bg-bg-elevated/50 p-4">
              <DefinitionList
                items={[
                  { label: 'Slug', value: <span className="font-mono text-xs">{selected.slug}</span> },
                  { label: 'Tenant status', value: <StatusPill status={selected.status ?? (selected.isActive ? 'active' : 'suspended')} /> },
                  { label: 'Outlets', value: selected.outletCount },
                  { label: 'MRR contribution', value: formatInr(selected.mrrContribution ?? 0) },
                  { label: 'Grace until', value: formatDate(selected.graceUntil) },
                  { label: 'Last payment', value: <span className="font-mono text-xs">{selected.lastRazorpayPaymentId ?? '—'}</span> },
                ]}
              />
              <Link to={`/tenants/${selected.id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                <Settings2 size={14} aria-hidden="true" />
                Open tenant
              </Link>
            </div>
            <LabeledInput label="Plan">
              <select value={planSlug} onChange={(e) => setPlanSlug(e.target.value)} className={inputClass}>
                {plans.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.visibility === 'private' ? 'Custom: ' : ''}
                    {p.name} ({formatInr(p.priceMonthly)}){p.visibility === 'private' ? ' (private)' : ''}
                  </option>
                ))}
              </select>
            </LabeledInput>
            <LabeledInput label="Subscription status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                {SUB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </LabeledInput>
          </>
        ) : null}
      </FormDrawer>
    </div>
  );
}
