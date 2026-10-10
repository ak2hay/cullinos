import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Building2, CalendarClock, IndianRupee, Plus, ReceiptText, RefreshCcw, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCssVar } from '@cullinos/ui';
import { Notice } from '@/components/common';
import {
  CHART_COLORS,
  chartTooltipStyle,
  DataTable,
  EntityAvatar,
  KpiCard,
  PageHeader,
  SectionCard,
  Segmented,
  StatusPill,
} from '@/components/ui';
import { superAdminApi, type AnalyticsRange } from '@/lib/api';
import { formatDate, formatInr, formatInrCompact, relativeTime } from '@/lib/format';
import { useCan } from '@/lib/permissions';
import { approvalsApi } from '@/lib/platform-api';
import { useAuthStore } from '@/stores/auth';

const RANGES: Array<{ value: AnalyticsRange; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

function shortDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function TrendChart({
  data,
  color,
  name,
}: {
  data: Array<{ label: string; count: number }>;
  color: string;
  name: string;
}) {
  const tick = useCssVar('--color-text-muted', '#8a8a8a');
  const grid = useCssVar('--color-line-subtle', 'rgba(0,0,0,0.06)');
  const id = `grad-${name.replace(/\s/g, '')}`;
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis allowDecimals={false} tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Area type="monotone" dataKey="count" name={name} stroke={color} fill={`url(#${id})`} strokeWidth={2.25} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DashboardPage() {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const navigate = useNavigate();
  const can = useCan();
  const admin = useAuthStore((s) => s.admin);
  const canSeeTenants = can('tenants.read');

  const analytics = useQuery({
    queryKey: ['super-admin', 'analytics', range],
    queryFn: () => superAdminApi.analyticsOverview(range),
    refetchInterval: 30_000,
  });
  const tenants = useQuery({
    queryKey: ['super-admin', 'organizations', 1, 'dash'],
    queryFn: () => superAdminApi.listOrganizations(1, 6),
    enabled: canSeeTenants,
  });
  const approvals = useQuery({ queryKey: ['super-admin', 'approvals', 'count'], queryFn: approvalsApi.count });

  const data = analytics.data;
  const saas = data?.saas;
  const ops = data?.ops;
  const loading = analytics.isLoading;
  const v = (x: string | number | undefined) => (loading ? '…' : (x ?? '—'));

  const newOrgs = saas?.newOrganizationsByDay.map((p) => ({ ...p, label: shortDate(p.date) })) ?? [];
  const orders = ops?.ordersByDay.map((p) => ({ ...p, label: shortDate(p.date) })) ?? [];
  const planMix = saas?.planMix ?? [];
  const planTotal = planMix.reduce((a, p) => a + p.count, 0);
  const firstName = (admin?.name ?? '').split(' ')[0];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={false}
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description="SaaS revenue and platform operations at a glance."
        actions={
          <>
            <Segmented label="Date range" options={RANGES} value={range} onChange={setRange} />
            {can('tenants.write') ? (
              <Link
                to="/tenants?onboard=1"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-medium text-on-brand hover:bg-brand-primary-dark"
              >
                <Plus size={16} aria-hidden="true" />
                Onboard restaurant
              </Link>
            ) : null}
          </>
        }
      />

      {analytics.error ? (
        <Notice tone="error">{analytics.error instanceof Error ? analytics.error.message : 'Failed to load analytics'}</Notice>
      ) : null}

      {(data?.alerts ?? []).map((alert) => (
        <Notice key={alert.message} tone={alert.severity === 'error' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'}>
          {alert.message}
          {alert.severity !== 'info' ? (
            <>
              {' · '}
              <Link to="/health" className="font-medium underline hover:no-underline">
                System health
              </Link>
            </>
          ) : null}
        </Notice>
      ))}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="MRR"
          icon={IndianRupee}
          tone="indigo"
          value={v(saas ? formatInrCompact(saas.mrr) : undefined)}
          title={saas ? formatInr(saas.mrr) : undefined}
          hint={saas ? `Monthly recurring · ${formatInr(saas.mrr)}` : 'Monthly recurring revenue'}
        />
        <KpiCard
          label="ARR"
          icon={TrendingUp}
          tone="violet"
          value={v(saas ? formatInrCompact(saas.arr) : undefined)}
          title={saas ? formatInr(saas.arr) : undefined}
          hint={saas ? `Annualised · ${formatInr(saas.arr)}` : 'Annualised'}
        />
        <KpiCard label="Active orgs" icon={Building2} tone="green" value={v(ops?.activeOrganizations)} hint="Live tenants" />
        <KpiCard label="Trials" icon={CalendarClock} tone="blue" value={v(saas?.trialCount)} hint={`${saas?.trialsEndingSoon.length ?? 0} ending this week`} />
        <KpiCard label="Orders today" icon={ReceiptText} tone="orange" value={v(ops?.ordersToday)} hint="Across all tenants" />
        <KpiCard
          label="Failed syncs"
          icon={RefreshCcw}
          tone={(ops?.failedSyncEvents ?? 0) > 0 ? 'rose' : 'slate'}
          value={v(ops?.failedSyncEvents)}
          hint="Offline sync queue"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="New organizations" description="Signups over the selected range">
          <TrendChart data={newOrgs} color={CHART_COLORS[0]} name="New orgs" />
        </SectionCard>
        <SectionCard title="Orders" description="Platform order volume by day">
          <TrendChart data={orders} color={CHART_COLORS[3]} name="Orders" />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Plan mix" description="Tenants by subscription plan">
          {planMix.length === 0 ? (
            <p className="py-16 text-center text-sm text-text-muted">No plan data</p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
              <div className="relative h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={planMix} dataKey="count" nameKey="planName" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                      {planMix.map((p, i) => (
                        <Cell key={p.planSlug} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-2xl font-bold">{planTotal}</span>
                  <span className="text-xs text-text-muted">tenants</span>
                </div>
              </div>
              <ul className="w-full space-y-2 text-sm">
                {planMix.map((p, i) => (
                  <li key={p.planSlug} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="flex-1 truncate">{p.planName}</span>
                    <span className="font-medium tabular-nums">{p.count}</span>
                  </li>
                ))}
                <li className="border-t border-line-subtle pt-2 text-xs text-text-muted">Cancelled in range: {saas?.cancelledInRange ?? 0}</li>
              </ul>
            </div>
          )}
        </SectionCard>

        <SectionCard
          className="lg:col-span-2"
          flush
          title="Trials ending soon"
          description="Next 7 days"
          actions={
            <Link to="/tenants" className="text-sm font-medium text-accent hover:underline">
              All tenants
            </Link>
          }
        >
          <DataTable
            bare
            rows={saas?.trialsEndingSoon ?? []}
            loading={loading}
            skeletonRows={3}
            getRowKey={(t) => t.organizationId}
            onRowClick={(t) => navigate(`/tenants/${t.organizationId}`)}
            emptyMessage="No trials ending in the next 7 days"
            columns={[
              {
                key: 'org',
                header: 'Organization',
                cell: (t) => (
                  <div className="flex items-center gap-3">
                    <EntityAvatar name={t.organizationName} seed={t.organizationId} size={32} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.organizationName}</p>
                      <p className="truncate text-xs text-text-muted">{t.organizationSlug}</p>
                    </div>
                  </div>
                ),
              },
              { key: 'plan', header: 'Plan', cell: (t) => t.planName },
              {
                key: 'ends',
                header: 'Trial ends',
                cell: (t) => (
                  <div>
                    <p>{formatDate(t.trialEndsAt)}</p>
                    <p className="text-xs text-text-muted">{relativeTime(t.trialEndsAt)}</p>
                  </div>
                ),
              },
            ]}
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {canSeeTenants ? (
          <SectionCard
            className="lg:col-span-2"
            flush
            title="Recent tenants"
            actions={
              <Link to="/tenants" className="text-sm font-medium text-accent hover:underline">
                View all
              </Link>
            }
          >
            <DataTable
              bare
              rows={tenants.data?.data ?? []}
              loading={tenants.isLoading}
              skeletonRows={4}
              getRowKey={(t) => t.id}
              onRowClick={(t) => navigate(`/tenants/${t.id}`)}
              emptyMessage="No tenants yet"
              columns={[
                {
                  key: 'org',
                  header: 'Organization',
                  cell: (t) => (
                    <div className="flex items-center gap-3">
                      <EntityAvatar name={t.name} seed={t.id} size={32} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.name}</p>
                        <p className="truncate text-xs text-text-muted">{t.slug}</p>
                      </div>
                    </div>
                  ),
                },
                { key: 'plan', header: 'Plan', cell: (t) => <span className="capitalize">{t.planName ?? t.plan ?? '—'}</span> },
                { key: 'status', header: 'Status', cell: (t) => <StatusPill status={t.status ?? (t.isActive ? 'active' : 'suspended')} /> },
                {
                  key: 'created',
                  header: 'Created',
                  cell: (t) => <span className="text-text-muted">{relativeTime(t.createdAt)}</span>,
                },
              ]}
            />
          </SectionCard>
        ) : null}

        <SectionCard title="Needs attention" className={canSeeTenants ? '' : 'lg:col-span-3'}>
          <ul className="space-y-2">
            <li>
              <Link to="/approvals" className="flex items-center gap-3 rounded-lg border border-line-subtle p-3 hover:bg-hover">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/12 text-indigo-600 dark:text-indigo-300">
                  <BadgeCheck size={18} aria-hidden="true" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">Approvals</span>
                  <span className="block text-xs text-text-muted">Waiting on you</span>
                </span>
                <span className="font-display text-lg font-semibold">{approvals.data?.count ?? 0}</span>
              </Link>
            </li>
            <li>
              <Link to="/tenants" className="flex items-center gap-3 rounded-lg border border-line-subtle p-3 hover:bg-hover">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/12 text-sky-600 dark:text-sky-300">
                  <CalendarClock size={18} aria-hidden="true" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">Trials ending</span>
                  <span className="block text-xs text-text-muted">Next 7 days</span>
                </span>
                <span className="font-display text-lg font-semibold">{saas?.trialsEndingSoon.length ?? 0}</span>
              </Link>
            </li>
            {can('health.read') ? (
              <li>
                <Link to="/health" className="flex items-center gap-3 rounded-lg border border-line-subtle p-3 hover:bg-hover">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-300">
                    <AlertTriangle size={18} aria-hidden="true" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">Platform alerts</span>
                    <span className="block text-xs text-text-muted">Sync and delivery issues</span>
                  </span>
                  <span className="font-display text-lg font-semibold">{data?.alerts.filter((a) => a.severity !== 'info').length ?? 0}</span>
                </Link>
              </li>
            ) : null}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
