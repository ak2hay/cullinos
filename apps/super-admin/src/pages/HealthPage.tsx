import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { superAdminApi } from '@/lib/api';

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

  const metrics = data?.metrics;

  const cards = [
    { label: 'Total organizations', value: metrics?.totalOrganizations },
    { label: 'Active organizations', value: metrics?.activeOrganizations },
    { label: 'Trial organizations', value: metrics?.trialOrganizations },
    { label: 'Orders today', value: metrics?.ordersToday },
    { label: 'Pending sync events', value: metrics?.pendingSyncEvents },
    {
      label: 'Failed sync events',
      value: metrics?.failedSyncEvents ?? metrics?.failedNotifications,
    },
    { label: 'Unread notifications', value: metrics?.unreadNotifications },
  ];

  const sms = smsQuery.data;
  const hasAlerts =
    (metrics?.failedSyncEvents ?? metrics?.failedNotifications ?? 0) > 0 ||
    (metrics?.pendingSyncEvents ?? 0) > 50;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">System health</h1>
          <p className="mt-1 text-text-secondary">
            Platform status and operational metrics.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => {
              void refetch();
              void smsQuery.refetch();
            }}
            disabled={isFetching || smsQuery.isFetching}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
          >
            {isFetching || smsQuery.isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load health data'}
        </div>
      ) : null}

      {hasAlerts ? (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          Operational alerts detected.{' '}
          <Link to="/" className="underline hover:no-underline">
            View dashboard charts
          </Link>
        </div>
      ) : null}

      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-bg-card p-5">
        <span
          className={`h-3 w-3 rounded-full ${
            data?.status === 'ok' ? 'bg-status-success' : 'bg-status-warning'
          }`}
        />
        <div>
          <p className="font-medium capitalize">
            {data?.status ?? (isLoading ? 'Loading…' : 'Unknown')}
          </p>
          <p className="text-sm text-text-muted">
            Database: {data?.database ?? '—'} · Last check:{' '}
            {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '—'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/5 bg-bg-card p-5">
            <p className="text-sm text-text-muted">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">
              {isLoading ? '…' : (card.value ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/5 bg-bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">SMS / MSG91</h2>
            <p className="mt-1 text-sm text-text-secondary">
              OTP delivery provider configuration status.
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              sms?.flowConfigured
                ? 'bg-status-success/15 text-status-success'
                : sms?.widgetConfigured
                  ? 'bg-status-warning/15 text-status-warning'
                  : 'bg-status-warning/15 text-status-warning'
            }`}
          >
            {smsQuery.isLoading
              ? '…'
              : sms?.flowConfigured
                ? 'Flow ready (Waiter)'
                : sms?.widgetConfigured
                  ? 'Widget only (Guest)'
                  : 'Not configured'}
          </span>
        </div>
        {smsQuery.error ? (
          <p className="mt-3 text-sm text-status-error">
            {smsQuery.error instanceof Error
              ? smsQuery.error.message
              : 'Failed to load SMS status'}
          </p>
        ) : (
          <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-text-muted">Flow (Waiter SMS)</dt>
              <dd className="mt-0.5 font-mono">
                {sms?.flowConfigured ? 'configured' : 'missing template/key'}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Widget (Guest)</dt>
              <dd className="mt-0.5 font-mono">
                {sms?.widgetConfigured ? 'configured' : 'not set'}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Sender ID</dt>
              <dd className="mt-0.5 font-mono">{sms?.senderId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Template ID</dt>
              <dd className="mt-0.5 font-mono">{sms?.templateId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">OTP TTL</dt>
              <dd className="mt-0.5 font-mono">
                {sms?.otpTtlSeconds != null ? `${sms.otpTtlSeconds}s` : '—'}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
