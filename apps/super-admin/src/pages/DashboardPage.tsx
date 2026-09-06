import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  superAdminApi,
  type AnalyticsRange,
} from '@/lib/api';

const RANGES: AnalyticsRange[] = ['7d', '30d', '90d'];
const PIE_COLORS = ['#3d9a6a', '#5b8def', '#e8a317', '#e85d5d', '#9b7ed9', '#5ec8c8'];

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function shortDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function DashboardPage() {
  const [range, setRange] = useState<AnalyticsRange>('30d');

  const analyticsQuery = useQuery({
    queryKey: ['super-admin', 'analytics', range],
    queryFn: () => superAdminApi.analyticsOverview(range),
    refetchInterval: 30_000,
  });

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'organizations', 1, 'dash'],
    queryFn: () => superAdminApi.listOrganizations(1, 8),
  });

  const data = analyticsQuery.data;
  const saas = data?.saas;
  const ops = data?.ops;

  const kpiCards = [
    { label: 'MRR', value: saas ? formatInr(saas.mrr) : '…' },
    { label: 'ARR', value: saas ? formatInr(saas.arr) : '…' },
    { label: 'Active orgs', value: ops?.activeOrganizations ?? '…' },
    { label: 'Trials', value: saas?.trialCount ?? '…' },
    { label: 'Orders today', value: ops?.ordersToday ?? '…' },
    { label: 'Failed syncs', value: ops?.failedSyncEvents ?? '…' },
  ];

  const newOrgsSeries =
    saas?.newOrganizationsByDay.map((p) => ({
      ...p,
      label: shortDate(p.date),
    })) ?? [];
  const ordersSeries =
    ops?.ordersByDay.map((p) => ({
      ...p,
      label: shortDate(p.date),
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-text-secondary">
            SaaS revenue and platform operations at a glance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  range === r
                    ? 'bg-brand-primary text-bg-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Link
            to="/tenants?onboard=1"
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-bg-primary hover:bg-brand-primary-dark"
          >
            Onboard restaurant
          </Link>
        </div>
      </div>

      {analyticsQuery.error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {analyticsQuery.error instanceof Error
            ? analyticsQuery.error.message
            : 'Failed to load analytics'}
        </div>
      ) : null}

      {(data?.alerts?.length ?? 0) > 0 ? (
        <div className="space-y-2">
          {data!.alerts.map((alert) => (
            <div
              key={alert.message}
              className={`rounded-xl border px-4 py-3 text-sm ${
                alert.severity === 'error'
                  ? 'border-status-error/30 bg-status-error/10 text-status-error'
                  : alert.severity === 'warning'
                    ? 'border-status-warning/30 bg-status-warning/10 text-status-warning'
                    : 'border-white/10 bg-bg-card text-text-secondary'
              }`}
            >
              {alert.message}
              {alert.severity !== 'info' ? (
                <>
                  {' · '}
                  <Link to="/health" className="underline hover:no-underline">
                    System health
                  </Link>
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/5 bg-bg-card p-5">
            <p className="text-sm text-text-muted">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {analyticsQuery.isLoading ? '…' : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-bg-card p-5">
          <h2 className="font-medium">New organizations</h2>
          <p className="mt-1 text-sm text-text-muted">Signups over the selected range</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={newOrgsSeries}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8a8a8a', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#8a8a8a', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="New orgs"
                  stroke="#3d9a6a"
                  fill="rgba(61,154,106,0.25)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-bg-card p-5">
          <h2 className="font-medium">Orders</h2>
          <p className="mt-1 text-sm text-text-muted">Platform order volume by day</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ordersSeries}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8a8a8a', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#8a8a8a', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Orders"
                  stroke="#5b8def"
                  fill="rgba(91,141,239,0.25)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-bg-card p-5 lg:col-span-1">
          <h2 className="font-medium">Plan mix</h2>
          <p className="mt-1 text-sm text-text-muted">Tenants by subscription plan</p>
          <div className="mt-4 h-56">
            {(saas?.planMix.length ?? 0) === 0 ? (
              <p className="pt-16 text-center text-sm text-text-muted">No plan data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={saas!.planMix}
                    dataKey="count"
                    nameKey="planName"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {saas!.planMix.map((_, i) => (
                      <Cell key={saas!.planMix[i]!.planSlug} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1a1a1a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Cancelled in range: {saas?.cancelledInRange ?? 0}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/5 bg-bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <h2 className="font-medium">Trials ending soon</h2>
            <Link to="/tenants" className="text-sm text-brand-primary hover:underline">
              All tenants
            </Link>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Ends</th>
              </tr>
            </thead>
            <tbody>
              {(saas?.trialsEndingSoon ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-text-muted">
                    No trials ending in the next 7 days.
                  </td>
                </tr>
              ) : (
                saas!.trialsEndingSoon.map((t) => (
                  <tr key={t.organizationId} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <Link
                        to={`/tenants/${t.organizationId}`}
                        className="font-medium hover:text-brand-primary"
                      >
                        {t.organizationName}
                      </Link>
                      <p className="text-xs text-text-muted">{t.organizationSlug}</p>
                    </td>
                    <td className="px-4 py-3">{t.planName}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <h2 className="font-medium">Recent tenants</h2>
          <Link to="/tenants" className="text-sm text-brand-primary hover:underline">
            View all
          </Link>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {tenantsQuery.isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : (tenantsQuery.data?.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  No tenants yet.
                </td>
              </tr>
            ) : (
              (tenantsQuery.data?.data ?? []).map((tenant) => (
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
                  <td className="px-4 py-3">{tenant.plan ?? '—'}</td>
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
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
