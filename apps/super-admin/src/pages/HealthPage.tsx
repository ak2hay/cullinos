import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BellRing,
  Building2,
  CheckCircle2,
  Database,
  FlaskConical,
  MessageSquare,
  RefreshCw,
  ShoppingBag,
  Timer,
  XCircle,
} from 'lucide-react';
import { Button } from '@cullinos/ui';
import { Card, DefinitionList, KpiCard, KpiGrid, PageHeader, SectionCard, StatusDot, StatusPill } from '@/components/ui';
import { Notice } from '@/components/common';
import { superAdminApi } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatNumber, relativeTime } from '@/lib/format';
import { useCan } from '@/lib/permissions';
import { reportsApi } from '@/lib/platform-api';

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between">
            <span className="capitalize">{r.label}</span>
            <span className="text-text-secondary">{r.value}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-hover-strong">
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {rows.length === 0 ? <li className="text-sm text-text-muted">No data.</li> : null}
    </ul>
  );
}

export function HealthPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['super-admin', 'health'],
    queryFn: superAdminApi.health,
    refetchInterval: 30_000,
  });

  const smsQuery = useQuery({
    queryKey: ['super-admin', 'sms-status'],
    queryFn: superAdminApi.smsStatus,
    refetchInterval: 60_000,
  });

  const can = useCan();
  const overview = useQuery({
    queryKey: ['super-admin', 'ops-overview'],
    queryFn: reportsApi.overview,
    enabled: can('reports.read'),
    refetchInterval: 120_000,
  });

  const metrics = data?.metrics;
  const sms = smsQuery.data;
  const failed = metrics?.failedSyncEvents ?? metrics?.failedNotifications ?? 0;
  const pending = metrics?.pendingSyncEvents ?? 0;
  const hasAlerts = failed > 0 || pending > 50;
  const refreshing = isFetching || smsQuery.isFetching;
  const value = (n: number | undefined) => (isLoading ? '…' : formatNumber(n ?? 0));

  const services = [
    {
      name: 'API',
      icon: CheckCircle2,
      ok: data?.status === 'ok',
      state: data?.status ?? (isLoading ? 'checking' : 'unknown'),
      detail: data?.timestamp ? `Checked ${relativeTime(data.timestamp)}` : 'Waiting for first check',
    },
    {
      name: 'Database',
      icon: Database,
      ok: data?.database === 'ok' || data?.database === 'connected' || data?.database === 'up',
      state: data?.database ?? (isLoading ? 'checking' : 'unknown'),
      detail: 'Primary Postgres',
    },
    {
      name: 'Sync queue',
      icon: RefreshCw,
      ok: failed === 0 && pending <= 50,
      state: failed > 0 ? `${failed} failed` : pending > 50 ? 'backlog' : 'healthy',
      detail: `${formatNumber(pending)} pending events`,
    },
    {
      name: 'SMS / MSG91',
      icon: MessageSquare,
      ok: Boolean(sms?.flowConfigured),
      state: smsQuery.isLoading
        ? 'checking'
        : sms?.flowConfigured
          ? 'Flow ready'
          : sms?.widgetConfigured
            ? 'Widget only'
            : 'Not configured',
      detail: 'OTP delivery provider',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System health"
        description="Platform status and operational metrics. Refreshes every 30 seconds."
        actions={
          <Button
            size="sm"
            variant="secondary"
            loading={refreshing}
            onClick={() => {
              void refetch();
              void smsQuery.refetch();
            }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {error ? <Notice tone="error">{errorMessage(error) ?? 'Failed to load health data'}</Notice> : null}
      {hasAlerts ? (
        <Notice tone="warning">
          Operational alerts detected: {failed > 0 ? `${failed} failed sync events` : `${pending} sync events pending`}.{' '}
          <Link to="/" className="font-medium underline hover:no-underline">
            View dashboard charts
          </Link>
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {services.map((s) => (
          <Card key={s.name} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-secondary text-text-secondary">
                <s.icon size={18} aria-hidden="true" />
              </span>
              {s.ok ? (
                <CheckCircle2 size={18} className="text-status-success" aria-label="Operational" />
              ) : isLoading ? null : s.state === 'unknown' ? (
                <AlertTriangle size={18} className="text-status-warning" aria-label="Unknown" />
              ) : (
                <XCircle size={18} className="text-status-warning" aria-label="Needs attention" />
              )}
            </div>
            <p className="mt-4 font-medium">{s.name}</p>
            <p className="mt-1 flex items-center gap-2 text-sm capitalize text-text-secondary">
              <StatusDot tone={s.ok ? 'success' : 'warning'} />
              {s.state}
            </p>
            <p className="mt-1 text-xs text-text-muted">{s.detail}</p>
          </Card>
        ))}
      </div>

      <KpiGrid>
        <KpiCard label="Total organizations" value={value(metrics?.totalOrganizations)} icon={Building2} tone="indigo" />
        <KpiCard label="Active organizations" value={value(metrics?.activeOrganizations)} icon={CheckCircle2} tone="green" />
        <KpiCard label="Trial organizations" value={value(metrics?.trialOrganizations)} icon={FlaskConical} tone="orange" />
        <KpiCard label="Orders today" value={value(metrics?.ordersToday)} icon={ShoppingBag} tone="blue" />
        <KpiCard label="Pending sync events" value={value(metrics?.pendingSyncEvents)} icon={Timer} tone={pending > 50 ? 'orange' : 'slate'} />
        <KpiCard label="Failed sync events" value={value(failed)} icon={AlertTriangle} tone={failed > 0 ? 'rose' : 'slate'} />
        <KpiCard label="Unread notifications" value={value(metrics?.unreadNotifications)} icon={BellRing} tone="violet" />
      </KpiGrid>

      {can('reports.read') ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Tenants by status">
            <Bars rows={Object.entries(overview.data?.tenants.byStatus ?? {}).map(([k, v]) => ({ label: k, value: v }))} />
            {overview.data ? <p className="mt-3 text-xs text-text-muted">{overview.data.tenants.newLast30d} new in the last 30 days</p> : null}
          </SectionCard>
          <SectionCard title="Staff by department">
            <Bars rows={(overview.data?.staff.byDepartment ?? []).map((s) => ({ label: s.department, value: s.count }))} />
          </SectionCard>
        </div>
      ) : null}

      <SectionCard
        title="SMS / MSG91"
        description="OTP delivery provider configuration status."
        actions={
          <StatusPill
            status={sms?.flowConfigured ? 'active' : 'pending'}
            tone={sms?.flowConfigured ? 'success' : 'warning'}
            label={smsQuery.isLoading ? 'Checking…' : sms?.flowConfigured ? 'Flow ready (Waiter)' : sms?.widgetConfigured ? 'Widget only (Guest)' : 'Not configured'}
          />
        }
      >
        {smsQuery.error ? (
          <Notice tone="error">{errorMessage(smsQuery.error) ?? 'Failed to load SMS status'}</Notice>
        ) : (
          <DefinitionList
            columns={3}
            items={[
              { label: 'Flow (Waiter SMS)', value: sms?.flowConfigured ? 'Configured' : 'Missing template/key' },
              { label: 'Widget (Guest)', value: sms?.widgetConfigured ? 'Configured' : 'Not set' },
              { label: 'Sender ID', value: <span className="font-mono">{sms?.senderId ?? '—'}</span> },
              { label: 'Template ID', value: <span className="font-mono">{sms?.templateId ?? '—'}</span> },
              { label: 'OTP TTL', value: sms?.otpTtlSeconds != null ? `${sms.otpTtlSeconds}s` : '—' },
            ]}
          />
        )}
      </SectionCard>
    </div>
  );
}
