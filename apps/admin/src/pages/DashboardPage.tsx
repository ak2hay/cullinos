import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, PageShell } from '@cullinos/ui';
import { analyticsApi, inventoryApi, outletsApi, reportsApi, reservationsApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';

// ── Helpers ────────────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  loading: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <p className="text-sm text-text-secondary">{label}</p>
      {loading ? (
        <div className="mt-2 h-9 w-24 animate-pulse rounded bg-bg-elevated" />
      ) : (
        <p className="mt-2 font-mono text-3xl font-semibold text-brand-primary">{value}</p>
      )}
      {hint ? <p className="mt-2 text-xs text-text-muted">{hint}</p> : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-brand-primary/0 via-brand-primary/50 to-brand-primary/0" />
    </Card>
  );
}

function TrendChart({
  days,
  loading,
}: {
  days: Array<{ date: string; revenue: number; orders: number }>;
  loading: boolean;
}) {
  const [mode, setMode] = useState<'revenue' | 'orders'>('revenue');

  const values = days.map((d) => (mode === 'revenue' ? d.revenue : d.orders));
  const max = Math.max(...values, 1);

  if (loading) {
    return (
      <div className="mt-4 flex h-24 items-end gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-sm bg-bg-elevated"
            style={{ height: `${40 + Math.random() * 40}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
          {mode === 'revenue' ? 'Revenue trend' : 'Order count trend'}
        </span>
        <div className="flex gap-1 rounded-lg bg-bg-elevated p-1">
          {(['revenue', 'orders'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                mode === m
                  ? 'bg-brand-primary/20 text-brand-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {m === 'revenue' ? 'Revenue' : 'Orders'}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex h-24 items-end gap-1" aria-label="trend chart">
        {days.map((d, i) => {
          const pct = Math.max(8, (values[i] / max) * 100);
          return (
            <div key={d.date} className="group relative flex flex-1 flex-col items-center">
              <div
                className="w-full rounded-t-sm bg-brand-primary/60 transition-all hover:bg-brand-primary/80"
                style={{ height: `${pct}%` }}
              />
              {/* tooltip on hover */}
              <div className="absolute bottom-full mb-1 hidden rounded bg-bg-elevated px-2 py-1 text-xs text-text-primary shadow group-hover:block whitespace-nowrap z-10">
                {fmtDate(d.date)}:{' '}
                {mode === 'revenue'
                  ? `₹${(d.revenue / 100).toFixed(0)}`
                  : `${d.orders} orders`}
              </div>
              <span className="mt-1 text-[9px] text-text-muted">{fmtDate(d.date).split(' ')[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const outletId = useAuthStore((s) => s.selectedOutletId);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [trendDays, setTrendDays] = useState(7);

  // Scope label for display
  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const selectedOutlet = outletsQuery.data?.find((o) => o.id === outletId);
  const scopeLabel = selectedOutlet ? selectedOutlet.name : 'All outlets';

  // ── Queries ────────────────────────────────────────────────────
  // Always fire (no enabled gate) — when outletId is null it returns org-wide data
  const { data: dailyData, isLoading: dailyLoading, error: dailyError } = useQuery({
    queryKey: ['analytics', 'daily', date, outletId],
    queryFn: () => analyticsApi.daily({ date, outletId: outletId ?? undefined }),
  });

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['analytics', 'trend', trendDays, outletId],
    queryFn: () => analyticsApi.trend({ days: trendDays, outletId: outletId ?? undefined }),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['reports', 'smb', date, outletId],
    queryFn: () =>
      reportsApi.smbSummary({ date, outletId: outletId ?? undefined }),
  });

  const { data: lowStockItems = [] } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: inventoryApi.listLowStock,
  });

  const { data: reservationsToday = [], isLoading: reservationsLoading } = useQuery({
    queryKey: ['reservations', 'dashboard', date, outletId],
    queryFn: () =>
      reservationsApi.list({
        from: date,
        to: date,
        outletId: outletId ?? undefined,
      }),
  });

  const summary = dailyData?.summary;
  const reservationPending = reservationsToday.filter((r) => r.status === 'pending').length;
  const reservationConfirmed = reservationsToday.filter((r) => r.status === 'confirmed').length;
  const upcomingReservations = reservationsToday
    .filter((r) => !['cancelled', 'no_show'].includes(r.status))
    .slice(0, 5);

  const kpis = [
    {
      label: 'Revenue',
      value: summary ? formatMoney(summary.totalRevenue) : '—',
      hint: `${scopeLabel} · ${date === today ? 'Today' : date}`,
    },
    {
      label: 'Orders completed',
      value: summary ? String(summary.totalOrders) : '—',
      hint: `${summary?.cancelledOrders ?? 0} cancelled`,
    },
    {
      label: 'Open orders',
      value: summary ? String(summary.openOrders) : '—',
      hint: 'In progress or held',
    },
    {
      label: 'Avg order value',
      value: summary ? formatMoney(summary.averageOrderValue) : '—',
      hint: 'Per completed order',
    },
  ];

  const topItems = (summaryData?.topItems as Array<{ name: string; quantity: number }> | undefined) ?? [];

  return (
    <PageShell
      title={`Good ${getGreeting()}, ${user?.firstName}`}
      description={`Performance overview · ${scopeLabel}`}
      actions={
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
          />
        </div>
      }
    >
      {/* ── Error ── */}
      {dailyError ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {dailyError instanceof Error ? dailyError.message : 'Failed to load analytics'}
        </div>
      ) : null}

      {/* ── Org/outlet scope notice ── */}
      {!outletId ? (
        <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-2 text-xs text-text-secondary">
          Showing <span className="font-semibold text-brand-primary">organisation-wide</span> rollup.
          Select an outlet from the top nav to scope to a single location.
        </div>
      ) : null}

      {/* ── KPI cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            loading={dailyLoading}
          />
        ))}
      </div>

      {/* ── Trend chart + top items ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Trend chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-base font-semibold tracking-tight">Trend</h2>
            <div className="flex gap-1 rounded-lg bg-bg-elevated p-1">
              {([7, 14, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTrendDays(d)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                    trendDays === d
                      ? 'bg-brand-primary/20 text-brand-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <TrendChart days={trendData?.days ?? []} loading={trendLoading} />
        </Card>

        {/* Top items */}
        <Card>
          <h2 className="font-display text-base font-semibold tracking-tight">Top items</h2>
          {topItems.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No data for this date.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {topItems.slice(0, 8).map((item, i) => (
                <li key={item.name} className="flex items-center gap-2 text-sm">
                  <span className="w-5 shrink-0 text-right text-xs font-bold text-text-muted">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="shrink-0 font-mono text-xs text-text-secondary">
                    ×{item.quantity}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* ── Alerts row ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Open orders alert */}
        {summary && summary.openOrders > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
            <span className="text-2xl">🟡</span>
            <div>
              <p className="font-semibold text-brand-primary">
                {summary.openOrders} open order{summary.openOrders === 1 ? '' : 's'}
              </p>
              <p className="text-sm text-text-secondary">In progress or being prepared right now.</p>
            </div>
          </div>
        ) : null}

        {/* Low-stock alert */}
        {lowStockItems.length > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-status-warning/30 bg-status-warning/5 p-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-status-warning">
                {lowStockItems.length} low-stock item{lowStockItems.length === 1 ? '' : 's'}
              </p>
              <p className="text-sm text-text-secondary">
                {lowStockItems
                  .slice(0, 3)
                  .map((i) => i.name)
                  .join(', ')}
                {lowStockItems.length > 3 ? ` +${lowStockItems.length - 3} more` : ''}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Reservations ── */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Reservations</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {reservationsLoading
                ? 'Loading…'
                : `${reservationsToday.length} total · ${reservationPending} pending · ${reservationConfirmed} confirmed`}
            </p>
          </div>
          <Link
            to="/reservations"
            className="text-sm font-medium text-brand-primary hover:underline"
          >
            Open reservations
          </Link>
        </div>
        {upcomingReservations.length === 0 && !reservationsLoading ? (
          <p className="mt-4 text-sm text-text-muted">No reservations for this date.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {upcomingReservations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <p className="font-medium">
                    {r.customerName} · {r.partySize} guests
                  </p>
                  <p className="text-text-secondary">
                    {new Date(r.reservedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {r.outlet?.name ? ` · ${r.outlet.name}` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs uppercase">
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Payment breakdown ── */}
      {dailyData?.paymentBreakdown && dailyData.paymentBreakdown.length > 0 ? (
        <Card>
          <h2 className="font-display text-lg font-semibold tracking-tight">Payment breakdown</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {dailyData.paymentBreakdown.map((payment) => (
              <div
                key={payment.method}
                className="rounded-lg border border-white/5 bg-bg-elevated px-4 py-3"
              >
                <p className="text-sm text-text-secondary capitalize">{payment.method}</p>
                <p className="mt-1 font-mono text-lg font-semibold">
                  {formatMoney(payment.amount)}
                </p>
                <p className="text-xs text-text-muted">{payment.count} transactions</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* ── Outlet comparison (multi-outlet) ── */}
      {!outletId && outletsQuery.data && outletsQuery.data.length > 1 ? (
        <OutletComparisonCard date={date} />
      ) : null}
    </PageShell>
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
    <Card padding="none" className="overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h2 className="font-semibold">Outlet comparison — {date}</h2>
      </div>
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
            <th className="px-4 py-3 font-medium">Outlet</th>
            <th className="px-4 py-3 font-medium">Revenue</th>
            <th className="px-4 py-3 font-medium">Orders</th>
            <th className="px-4 py-3 font-medium">Avg order</th>
          </tr>
        </thead>
        <tbody>
          {comparison.map((row) => (
            <tr key={row.outletId} className="border-b border-white/5">
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
