import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, Clock, IndianRupee, ReceiptText, TriangleAlert } from 'lucide-react';
import {
  BUSINESS_TYPES,
  RESTAURANT_SIZES,
  canAccessPortalMode,
  isAdminNavPathVisible,
  isErpNavPathAllowed,
  type BusinessType,
  type RestaurantSize,
} from '@cullinos/shared';
import { Card } from '@cullinos/ui';
import { analyticsApi, organizationsApi, outletsApi, reportsApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useLowStock, useOpenOrders } from '@/lib/useShellAlerts';
import { useAuthStore } from '@/stores/auth';
import { KpiCard } from '@/features/dashboard/KpiCard';
import { LiveOrders } from '@/features/dashboard/LiveOrders';
import { QUICK_ACTIONS, QuickActions } from '@/features/dashboard/QuickActions';
import { StatusDonut, type StatusCounts } from '@/features/dashboard/StatusDonut';
import { TopItems, type TopItem } from '@/features/dashboard/TopItems';
import { TrendChart } from '@/features/dashboard/TrendChart';
import { localYmd, percentChange, shiftYmd } from '@/features/dashboard/chart-utils';

type Range = 'today' | 'week' | 'month' | 'custom';

const RANGES: Array<{ id: Range; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

const COMPARE_LABEL: Record<Range, string> = {
  today: 'vs yesterday',
  week: 'vs previous week',
  month: 'vs previous month',
  custom: 'vs previous day',
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** Days elapsed in the range, today included (week starts Monday). */
function rangeDays(range: Range): number {
  const now = new Date();
  if (range === 'week') return ((now.getDay() + 6) % 7) + 1;
  if (range === 'month') return now.getDate();
  return 1;
}

function parseEnum<T extends string>(value: string | null | undefined, all: readonly string[]): T | null {
  return value && all.includes(value) ? (value as T) : null;
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
  style,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      style={style}
      className={`animate-slide-up rounded-2xl border border-line-subtle bg-bg-card p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ViewAll({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline"
    >
      View all
      <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex gap-1 rounded-xl border border-line-subtle bg-bg-card p-1 shadow-sm">
      {options.map((opt) => (
        <button
          key={String(opt.id)}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded-lg font-medium transition-colors duration-150 ${
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
          } ${
            value === opt.id
              ? 'bg-brand-primary text-on-brand shadow-sm'
              : 'text-text-secondary hover:bg-hover hover:text-text-primary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const stagger = (i: number): CSSProperties => ({ animationDelay: `${i * 50}ms` });

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const permissions = useAuthStore((s) => s.permissions);

  const today = localYmd();
  const [range, setRange] = useState<Range>('today');
  const [customDate, setCustomDate] = useState(today);
  const [trendDays, setTrendDays] = useState<7 | 14 | 30>(7);
  const [trendMode, setTrendMode] = useState<'revenue' | 'orders'>('revenue');

  const dayDate = range === 'custom' ? customDate : today;
  const days = rangeDays(range);
  const scope = outletId ?? undefined;

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const orgQuery = useQuery({ queryKey: ['organizations', 'current'], queryFn: organizationsApi.current });
  const selectedOutlet = outletsQuery.data?.find((o) => o.id === outletId);
  const scopeLabel = selectedOutlet ? selectedOutlet.name : 'all outlets';

  const dailyQuery = useQuery({
    queryKey: ['analytics', 'daily', dayDate, outletId],
    queryFn: () => analyticsApi.daily({ date: dayDate, outletId: scope }),
  });

  const prevDailyQuery = useQuery({
    queryKey: ['analytics', 'daily', shiftYmd(customDate, -1), outletId],
    queryFn: () => analyticsApi.daily({ date: shiftYmd(customDate, -1), outletId: scope }),
    enabled: range === 'custom',
  });

  // Enough history for the current period, the comparison period and a 7-day sparkline.
  const kpiTrendDays = Math.min(Math.max(days * 2, 7), 90);
  const kpiTrendQuery = useQuery({
    queryKey: ['analytics', 'trend', kpiTrendDays, outletId],
    queryFn: () => analyticsApi.trend({ days: kpiTrendDays, outletId: scope }),
  });

  const chartQuery = useQuery({
    queryKey: ['analytics', 'trend', trendDays, outletId],
    queryFn: () => analyticsApi.trend({ days: trendDays, outletId: scope }),
  });

  const summaryQuery = useQuery({
    queryKey: ['reports', 'smb', dayDate, outletId],
    queryFn: () => reportsApi.smbSummary({ date: dayDate, outletId: scope }),
  });

  const openOrders = useOpenOrders();
  const lowStock = useLowStock();

  const summary = dailyQuery.data?.summary;

  const kpis = useMemo(() => {
    const trend = kpiTrendQuery.data?.days ?? [];
    const spark = trend.slice(-7);
    const sparkRevenue = spark.map((d) => d.revenue);
    const sparkOrders = spark.map((d) => d.orders);
    const sparkAov = spark.map((d) => (d.orders > 0 ? d.revenue / d.orders : 0));

    let revenue = 0;
    let orders = 0;
    let prevRevenue = 0;
    let prevOrders = 0;

    if (range === 'custom') {
      const cur = dailyQuery.data?.summary;
      const prev = prevDailyQuery.data?.summary;
      const completed = (s: typeof cur) =>
        s ? (s.completedOrders ?? Math.max(s.totalOrders - s.openOrders - s.cancelledOrders, 0)) : 0;
      revenue = cur?.totalRevenue ?? 0;
      orders = completed(cur);
      prevRevenue = prev?.totalRevenue ?? 0;
      prevOrders = completed(prev);
    } else {
      const current = trend.slice(-days);
      const previous = trend.slice(-days * 2, -days);
      revenue = current.reduce((s, d) => s + d.revenue, 0);
      orders = current.reduce((s, d) => s + d.orders, 0);
      prevRevenue = previous.reduce((s, d) => s + d.revenue, 0);
      prevOrders = previous.reduce((s, d) => s + d.orders, 0);
    }

    const aov = orders > 0 ? revenue / orders : 0;
    const prevAov = prevOrders > 0 ? prevRevenue / prevOrders : 0;

    return {
      revenue,
      orders,
      aov,
      revenueDelta: percentChange(revenue, prevRevenue),
      ordersDelta: percentChange(orders, prevOrders),
      aovDelta: percentChange(aov, prevAov),
      sparkRevenue,
      sparkOrders,
      sparkAov,
    };
  }, [kpiTrendQuery.data, dailyQuery.data, prevDailyQuery.data, range, days]);

  const kpiLoading =
    range === 'custom' ? dailyQuery.isLoading || prevDailyQuery.isLoading : kpiTrendQuery.isLoading;
  const compare = COMPARE_LABEL[range];

  const statusCounts: StatusCounts | null = useMemo(() => {
    const data = dailyQuery.data;
    if (!data) return null;
    if (data.statusBreakdown) return data.statusBreakdown;
    const s = data.summary;
    return {
      completed: s.completedOrders ?? Math.max(s.totalOrders - s.openOrders - s.cancelledOrders, 0),
      open: s.openOrders,
      preparing: 0,
      cancelled: s.cancelledOrders,
    };
  }, [dailyQuery.data]);

  const topItems = ((summaryQuery.data?.topItems as TopItem[] | undefined) ?? []).slice(0, 5);

  const businessType = parseEnum<BusinessType>(orgQuery.data?.businessType, BUSINESS_TYPES);
  const restaurantSize = parseEnum<RestaurantSize>(orgQuery.data?.restaurantSize, RESTAURANT_SIZES);
  const quickActions = QUICK_ACTIONS.filter((action) =>
    action.to === '/pos'
      ? canAccessPortalMode(permissions, 'pos')
      : isErpNavPathAllowed(permissions, action.to) &&
        isAdminNavPathVisible(businessType, action.to, restaurantSize, orgQuery.data?.enabledModules),
  );

  const dayLabel =
    dayDate === today
      ? 'Today'
      : new Date(`${dayDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="animate-fade-in">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Good {getGreeting()}, {user?.firstName ?? 'there'}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Here&apos;s what&apos;s happening at <span className="font-medium text-text-primary">{scopeLabel}</span>{' '}
            {range === 'today' ? 'today' : range === 'custom' ? `on ${dayLabel}` : range === 'week' ? 'this week' : 'this month'}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented options={RANGES} value={range} onChange={setRange} />
          {range === 'custom' ? (
            <input
              type="date"
              value={customDate}
              max={today}
              onChange={(e) => setCustomDate(e.target.value || today)}
              className="h-10 animate-fade-in rounded-xl border border-line bg-bg-card px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-primary"
            />
          ) : null}
        </div>
      </div>

      {dailyQuery.error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {dailyQuery.error instanceof Error ? dailyQuery.error.message : 'Failed to load analytics'}
        </div>
      ) : null}

      {!outletId ? (
        <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-2 text-xs text-text-secondary">
          Showing <span className="font-semibold text-brand-primary">organisation-wide</span> rollup. Select an
          outlet from the top bar to scope to a single location.
        </div>
      ) : null}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          style={stagger(0)}
          label="Revenue"
          value={kpis.revenue}
          format={formatMoney}
          icon={<IndianRupee size={22} />}
          tone="success"
          delta={kpis.revenueDelta}
          hint={compare}
          spark={kpis.sparkRevenue}
          loading={kpiLoading}
        />
        <KpiCard
          style={stagger(1)}
          label="Orders completed"
          value={kpis.orders}
          format={(n) => Math.round(n).toLocaleString('en-IN')}
          icon={<ClipboardCheck size={22} />}
          tone="info"
          delta={kpis.ordersDelta}
          hint={compare}
          spark={kpis.sparkOrders}
          loading={kpiLoading}
        />
        <KpiCard
          style={stagger(2)}
          label="Open orders"
          value={summary?.openOrders ?? 0}
          format={(n) => Math.round(n).toLocaleString('en-IN')}
          icon={<Clock size={22} />}
          tone="warning"
          live={dayDate === today}
          hint="In progress or held"
          loading={dailyQuery.isLoading}
        />
        <KpiCard
          style={stagger(3)}
          label="Avg order value"
          value={kpis.aov}
          format={formatMoney}
          icon={<ReceiptText size={22} />}
          tone="violet"
          delta={kpis.aovDelta}
          hint={compare}
          spark={kpis.sparkAov}
          loading={kpiLoading}
        />
      </div>

      {/* Trend + status */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          style={stagger(4)}
          className="xl:col-span-2"
          title="Revenue trend"
          subtitle={trendMode === 'revenue' ? 'Daily revenue from completed orders' : 'Completed orders per day'}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                size="sm"
                options={[
                  { id: 'revenue' as const, label: 'Revenue' },
                  { id: 'orders' as const, label: 'Orders' },
                ]}
                value={trendMode}
                onChange={setTrendMode}
              />
              <Segmented
                size="sm"
                options={[
                  { id: 7 as const, label: '7d' },
                  { id: 14 as const, label: '14d' },
                  { id: 30 as const, label: '30d' },
                ]}
                value={trendDays}
                onChange={setTrendDays}
              />
            </div>
          }
        >
          <TrendChart
            days={chartQuery.data?.days ?? []}
            mode={trendMode}
            loading={chartQuery.isLoading}
            formatMoney={formatMoney}
          />
        </Panel>

        <Panel style={stagger(5)} title="Order status" subtitle={dayLabel} action={<ViewAll to="/orders" />}>
          <StatusDonut counts={statusCounts} loading={dailyQuery.isLoading} />
        </Panel>
      </div>

      {/* Live orders, top items, quick actions */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {openOrders.allowed ? (
          <Panel
            style={stagger(6)}
            title="Live orders"
            subtitle="Refreshes automatically"
            action={<ViewAll to="/orders" />}
          >
            <LiveOrders orders={openOrders.orders} loading={openOrders.isLoading} />
          </Panel>
        ) : null}

        <Panel style={stagger(7)} title="Top items" subtitle={dayLabel} action={<ViewAll to="/reports" />}>
          <TopItems items={topItems} loading={summaryQuery.isLoading} />
        </Panel>

        <Panel style={stagger(8)} title="Quick actions">
          <QuickActions actions={quickActions} />
        </Panel>
      </div>

      {/* Alerts */}
      {lowStock.items.length > 0 ? (
        <Link
          to="/inventory"
          className="group flex animate-slide-up items-start gap-3 rounded-2xl border border-status-warning/30 bg-status-warning/5 p-4 transition-colors hover:bg-status-warning/10"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-status-warning/15 text-status-warning">
            <TriangleAlert size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-status-warning">
              {lowStock.items.length} low-stock item{lowStock.items.length === 1 ? '' : 's'}
            </p>
            <p className="truncate text-sm text-text-secondary">
              {lowStock.items
                .slice(0, 3)
                .map((i) => i.name)
                .join(', ')}
              {lowStock.items.length > 3 ? ` +${lowStock.items.length - 3} more` : ''}
            </p>
          </div>
          <ArrowRight
            size={16}
            className="mt-2 text-status-warning transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      ) : null}

      {/* Payment breakdown */}
      {dailyQuery.data?.paymentBreakdown && dailyQuery.data.paymentBreakdown.length > 0 ? (
        <Panel title="Payment breakdown" subtitle={dayLabel}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {dailyQuery.data.paymentBreakdown.map((payment) => (
              <div key={payment.method} className="rounded-xl border border-line-subtle bg-bg-elevated px-4 py-3">
                <p className="text-sm capitalize text-text-secondary">{payment.method}</p>
                <p className="mt-1 font-mono text-lg font-semibold">{formatMoney(payment.amount)}</p>
                <p className="text-xs text-text-muted">{payment.count} transactions</p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {!outletId && outletsQuery.data && outletsQuery.data.length > 1 ? (
        <OutletComparisonCard date={dayDate} />
      ) : null}
    </div>
  );
}

function OutletComparisonCard({ date }: { date: string }) {
  const { data: comparison = [], isLoading } = useQuery({
    queryKey: ['analytics', 'outlet-comparison', date],
    queryFn: () => analyticsApi.outletComparison({ date }),
  });

  if (isLoading) return null;
  if (comparison.length === 0) return null;

  return (
    <Card padding="none" className="overflow-hidden rounded-2xl">
      <div className="border-b border-line-subtle px-4 py-3">
        <h2 className="font-semibold">Outlet comparison — {date}</h2>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line-subtle bg-bg-secondary text-text-muted">
            <th className="px-4 py-3 font-medium">Outlet</th>
            <th className="px-4 py-3 font-medium">Revenue</th>
            <th className="px-4 py-3 font-medium">Orders</th>
            <th className="px-4 py-3 font-medium">Avg order</th>
          </tr>
        </thead>
        <tbody>
          {comparison.map((row) => (
            <tr key={row.outletId} className="border-b border-line-subtle transition-colors hover:bg-hover">
              <td className="px-4 py-3 font-medium">{row.outletName}</td>
              <td className="px-4 py-3 font-mono">{formatMoney(row.revenue)}</td>
              <td className="px-4 py-3">{row.orders}</td>
              <td className="px-4 py-3 font-mono">{formatMoney(row.averageOrderValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
