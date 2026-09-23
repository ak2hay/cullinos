import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { guestOpsApi } from '@/lib/api';

const SECTION_LINKS = [
  { to: '/guest-ops/marketplace', label: 'Marketplace', desc: 'List, feature, and moderate outlets' },
  { to: '/guest-ops/discover', label: 'Discover', desc: 'Home screen sections and curation' },
  { to: '/guest-ops/banners', label: 'Banners', desc: 'Platform and org carousel slides' },
  { to: '/guest-ops/push', label: 'Push', desc: 'Draft, schedule, and send campaigns' },
  { to: '/guest-ops/offers', label: 'Offers', desc: 'Cross-tenant coupon oversight' },
  { to: '/guest-ops/reviews', label: 'Reviews', desc: 'Moderate guest outlet reviews' },
  { to: '/guest-ops/users', label: 'Users', desc: 'Search, export, and erase guest accounts' },
  { to: '/guest-ops/analytics', label: 'Analytics', desc: '30-day marketplace metrics' },
  { to: '/guest-ops/runtime', label: 'Runtime', desc: 'App version, maintenance, theme defaults, and URLs' },
] as const;

function KpiCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-bg-card p-4">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export function GuestOpsOverviewPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['guest-ops', 'overview'],
    queryFn: guestOpsApi.overview,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cullinos App — Overview</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Platform operations for the guest Android app: marketplace, content, campaigns, and
          compliance.
        </p>
      </div>

      {data?.maintenanceOn ? (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          <strong>Maintenance mode is ON.</strong>{' '}
          {data.maintenanceMessage || 'Guests see a maintenance screen.'}{' '}
          <Link to="/guest-ops/runtime" className="underline">
            Edit runtime settings
          </Link>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {(error as Error).message}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading overview…</p>
      ) : data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Listed outlets" value={data.listedOutlets} />
          <KpiCard label="Pending moderation" value={data.pendingModeration} />
          <KpiCard
            label="Reviews"
            value={data.reviews.visible}
            hint={`${data.reviews.hidden} hidden/removed`}
          />
          <KpiCard
            label="Push campaigns"
            value={data.campaigns.draft + data.campaigns.scheduled}
            hint={`${data.campaigns.draft} draft · ${data.campaigns.scheduled} scheduled`}
          />
          <KpiCard label="Active guest users" value={data.guestUsers} />
        </div>
      ) : null}

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="text-lg font-medium">Sections</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {SECTION_LINKS.map((s) => (
            <li key={s.to}>
              <Link
                to={s.to}
                className="block rounded-lg border border-white/5 p-3 transition hover:border-brand-primary/30 hover:bg-white/5"
              >
                <p className="font-medium text-brand-primary">{s.label}</p>
                <p className="text-sm text-text-secondary">{s.desc}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
