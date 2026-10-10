import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, PageHeader, PhoneField, Select, useToast } from '@cullinos/ui';
import { customersApi, loyaltyApi, type Customer, type CustomerSort } from '@/lib/api';
import { formatMoney } from '@/lib/format';

const PAGE_SIZE = 50;
const SORTS: CustomerSort[] = ['recent', 'spent', 'visits', 'points', 'name', 'joined'];

function formatDay(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export function CustomersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CustomerSort>('recent');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [marketingEmailOptIn, setMarketingEmailOptIn] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [redeemPoints, setRedeemPoints] = useState('');

  const overviewQuery = useQuery({
    queryKey: ['customers', 'overview', query, sort, page],
    queryFn: () => customersApi.overview({ q: query || undefined, sort, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const detailQuery = useQuery({
    queryKey: ['customers', 'detail', selectedId],
    queryFn: () => customersApi.get(selectedId!),
    enabled: Boolean(selectedId),
  });

  const settingsQuery = useQuery({
    queryKey: ['loyalty', 'settings'],
    queryFn: loyaltyApi.getSettings,
    enabled: Boolean(selectedId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['customers'] });

  const createMutation = useMutation({
    mutationFn: () =>
      customersApi.create({
        name,
        phone: phone || undefined,
        email: email || undefined,
        marketingEmailOptIn,
      }),
    onSuccess: () => {
      setName('');
      setPhone('');
      setEmail('');
      setMarketingEmailOptIn(false);
      setShowAdd(false);
      invalidate();
      toast.success(t('customers.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const stampMutation = useMutation({
    mutationFn: (customerId: string) => loyaltyApi.addStamp(customerId),
    onSuccess: () => {
      invalidate();
      toast.success(t('customers.stampAdded'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const eraseMutation = useMutation({
    mutationFn: (customerId: string) => customersApi.erase(customerId),
    onSuccess: () => {
      setSelectedId(null);
      invalidate();
      toast.success(t('customers.erased'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const exportMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const data = await customersApi.export(customerId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customer-${customerId}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success(t('customers.exported')),
    onError: (err: Error) => toast.error(err.message),
  });

  const redeemMutation = useMutation({
    mutationFn: ({ customerId, points }: { customerId: string; points: number }) =>
      loyaltyApi.redeem(customerId, points),
    onSuccess: (result) => {
      setRedeemPoints('');
      invalidate();
      toast.success(
        t('customers.redeemed', {
          points: result.pointsRedeemed,
          amount: result.discountAmount,
          remaining: result.remainingPoints,
        }),
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const overview = overviewQuery.data;
  const customers = overview?.data ?? [];
  const selected: Customer | undefined =
    detailQuery.data ?? customers.find((c) => c.id === selectedId);
  const minRedeem = settingsQuery.data?.minRedeem ?? 0;
  const redemptionValue = settingsQuery.data?.redemptionValue ?? 0;

  function runSearch() {
    setQuery(search.trim());
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('customers.title')}
        description={t('customers.subtitle')}
        actions={
          <Button type="button" onClick={() => setShowAdd((v) => !v)}>
            {t('customers.addCustomer')}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label={t('customers.kpiCustomers')} value={overview?.summary.totalCustomers ?? '—'} />
        <Kpi
          label={t('customers.kpiPoints')}
          value={overview ? overview.summary.totalPoints.toLocaleString('en-IN') : '—'}
        />
        <Kpi label={t('customers.kpiShowing')} value={overview?.meta.total ?? '—'} />
      </div>

      {showAdd ? (
        <section className="rounded-xl border border-line-subtle bg-bg-card p-5">
          <h2 className="font-semibold">{t('customers.addCustomer')}</h2>
          <p className="mt-1 text-xs text-text-muted">{t('customers.addHint')}</p>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              createMutation.mutate();
            }}
          >
            <Input
              label={t('customers.name')}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('customers.namePlaceholder')}
            />
            <PhoneField label={t('customers.phone')} value={phone} onChange={setPhone} />
            <Input
              label={t('customers.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guest@example.com"
            />
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-start gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={marketingEmailOptIn}
                  onChange={(e) => setMarketingEmailOptIn(e.target.checked)}
                />
                <span>{t('customers.emailOptIn')}</span>
              </label>
              <Button type="submit" loading={createMutation.isPending}>
                {t('customers.create')}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            label={t('customers.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('customers.searchPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch();
            }}
          />
        </div>
        <Button type="button" variant="secondary" onClick={runSearch}>
          {t('customers.search')}
        </Button>
        <div className="w-48">
          <Select
            label={t('customers.sortBy')}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as CustomerSort);
              setPage(1);
            }}
            options={SORTS.map((s) => ({ value: s, label: t(`customers.sort.${s}`) }))}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <section className="overflow-hidden rounded-xl border border-line-subtle bg-bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line-subtle bg-bg-elevated text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('customers.colCustomer')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('customers.colVisits')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('customers.colSpent')}</th>
                  <th className="px-4 py-3 font-medium">{t('customers.colLastVisit')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('customers.colPoints')}</th>
                  <th className="px-4 py-3 font-medium">{t('customers.colTier')}</th>
                  <th className="px-4 py-3 font-medium">{t('customers.colJoined')}</th>
                </tr>
              </thead>
              <tbody>
                {overviewQuery.isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                      {t('customers.loading')}
                    </td>
                  </tr>
                ) : overviewQuery.isError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-status-error">
                      {t('customers.loadFailed')}
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                      {t('customers.empty')}
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className={`cursor-pointer border-b border-line-subtle last:border-0 hover:bg-hover ${
                        selectedId === customer.id ? 'bg-brand-primary/10' : ''
                      }`}
                      onClick={() => setSelectedId(customer.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-text-muted">
                          {customer.phone ?? customer.email ?? t('customers.noPhone')}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{customer.visits ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(customer.totalSpent ?? 0)}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {customer.lastVisitAt ? formatDay(customer.lastVisitAt) : t('customers.never')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-brand-primary">
                        {customer.loyaltyPoints.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{customer.loyaltyTier?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-text-secondary">{formatDay(customer.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {overview && (page > 1 || overview.meta.hasMore) ? (
            <div className="flex items-center justify-between gap-3 border-t border-line-subtle px-4 py-3 text-sm">
              <span className="text-text-muted">{t('customers.page', { page })}</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-3 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('customers.previous')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-3 text-xs"
                  disabled={!overview.meta.hasMore}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('customers.next')}
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="rounded-xl border border-line-subtle bg-bg-card p-5">
          {!selectedId ? (
            <p className="text-sm text-text-muted">{t('customers.selectHint')}</p>
          ) : detailQuery.isLoading && !selected ? (
            <p className="text-sm text-text-muted">{t('customers.loading')}</p>
          ) : !selected ? (
            <p className="text-sm text-text-muted">{t('customers.notFound')}</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  <p className="text-sm text-text-secondary">{selected.phone ?? t('customers.noPhone')}</p>
                  <p className="text-sm text-text-secondary">{selected.email ?? t('customers.noEmail')}</p>
                </div>
                <button
                  type="button"
                  className="text-xs text-text-muted hover:text-text-primary"
                  onClick={() => setSelectedId(null)}
                >
                  {t('customers.close')}
                </button>
              </div>

              <div className="rounded-xl bg-brand-primary/10 p-4">
                <p className="text-xs uppercase tracking-wide text-text-muted">{t('customers.points')}</p>
                <p className="font-mono text-3xl font-bold text-brand-primary">
                  {selected.loyaltyPoints.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-text-muted">
                  {t('customers.tier')}: {selected.loyaltyTier?.name ?? '—'} · {t('customers.stamps')}:{' '}
                  {selected.stampCount}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Stat label={t('customers.visits')} value={selected.visits ?? 0} />
                <Stat label={t('customers.spent')} value={formatMoney(selected.totalSpent ?? 0)} />
                <Stat
                  label={t('customers.lastVisit')}
                  value={selected.lastVisitAt ? formatDay(selected.lastVisitAt) : t('customers.never')}
                />
                <Stat label={t('customers.joined')} value={formatDay(selected.createdAt)} />
                <Stat
                  label={t('customers.optIn')}
                  value={selected.marketingEmailOptIn ? t('customers.yes') : t('customers.no')}
                />
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-3 text-xs"
                  loading={stampMutation.isPending}
                  onClick={() => stampMutation.mutate(selected.id)}
                >
                  {t('customers.addStamp')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-3 text-xs"
                  loading={exportMutation.isPending}
                  onClick={() => exportMutation.mutate(selected.id)}
                >
                  {t('customers.export')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-3 text-xs"
                  loading={eraseMutation.isPending}
                  onClick={() => {
                    if (window.confirm(t('customers.eraseConfirm'))) eraseMutation.mutate(selected.id);
                  }}
                >
                  {t('customers.erase')}
                </Button>
              </div>

              <section className="space-y-3 rounded-lg border border-line bg-bg-elevated/50 p-3">
                <h3 className="text-sm font-medium">{t('customers.redeemTitle')}</h3>
                <p className="text-xs text-text-muted">
                  {t('customers.redeemHint', { min: minRedeem })}
                  {redemptionValue > 0 ? ` · ${t('customers.redeemValue', { value: redemptionValue })}` : ''}
                </p>
                <Input
                  label={t('customers.redeemPoints')}
                  type="number"
                  min={minRedeem || 1}
                  value={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.value)}
                  placeholder={String(minRedeem || 100)}
                />
                <Button
                  type="button"
                  loading={redeemMutation.isPending}
                  disabled={!redeemPoints || Number(redeemPoints) <= 0}
                  onClick={() => {
                    const points = Math.floor(Number(redeemPoints));
                    if (!Number.isFinite(points) || points <= 0) return;
                    redeemMutation.mutate({ customerId: selected.id, points });
                  }}
                >
                  {t('customers.redeem')}
                </Button>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-medium">{t('customers.recentOrders')}</h3>
                {selected.orders?.length ? (
                  <ul className="divide-y divide-line-subtle text-sm">
                    {selected.orders.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                        <span>
                          #{o.orderNumber}
                          <span className="ml-2 text-xs text-text-muted">{formatDay(o.createdAt)}</span>
                        </span>
                        <span className="text-right">
                          <span className="font-mono">{formatMoney(o.total)}</span>
                          <span className="ml-2 text-xs text-text-muted">
                            {t(`orderStatus.${o.status.toUpperCase()}`, { defaultValue: o.status })}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-text-muted">{t('customers.noOrders')}</p>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-medium">{t('customers.pointsHistory')}</h3>
                {selected.loyaltyTransactions?.length ? (
                  <ul className="divide-y divide-line-subtle text-sm">
                    {selected.loyaltyTransactions.slice(0, 15).map((tx) => (
                      <li key={tx.id} className="flex items-center justify-between gap-3 py-2">
                        <span>
                          {t(`customers.txn.${tx.type}`, { defaultValue: tx.type })}
                          <span className="ml-2 text-xs text-text-muted">{formatDay(tx.createdAt)}</span>
                        </span>
                        <span
                          className={`font-mono font-semibold ${
                            tx.points >= 0 ? 'text-status-success' : 'text-status-error'
                          }`}
                        >
                          {tx.points >= 0 ? '+' : ''}
                          {tx.points}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-text-muted">{t('customers.noPointsHistory')}</p>
                )}
              </section>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line-subtle bg-bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
