import { useQuery } from '@tanstack/react-query';
import { guestOpsApi } from '@/lib/api';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-bg-card p-4">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-xs text-text-muted">{sub}</p> : null}
    </div>
  );
}

export function GuestOpsAnalyticsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['guest-ops', 'analytics'],
    queryFn: guestOpsApi.analytics,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Guest app analytics</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Marketplace and engagement summary for the last 30 days.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {(error as Error).message}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading analytics…</p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Featured outlets (listed)" value={data.featuredOutlets} />
            <StatCard
              label="Guest users"
              value={data.guestUsers.active}
              sub={`${data.guestUsers.total} total · ${data.guestUsers.newLast30d} new (30d)`}
            />
            <StatCard
              label="Push campaigns sent (30d)"
              value={data.campaignsLast30d.count}
              sub={`${data.campaignsLast30d.sentCount} deliveries · ${data.campaignsLast30d.failedCount} failed`}
            />
            <StatCard
              label="Listed cities"
              value={data.listedByCity.length}
              sub="Top cities below"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-white/5 bg-bg-card p-5">
              <h2 className="text-lg font-medium">Listed outlets by city</h2>
              {data.listedByCity.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">No listed outlets.</p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-text-secondary">
                      <th className="pb-2 font-medium">City</th>
                      <th className="pb-2 text-right font-medium">Outlets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.listedByCity.map((row) => (
                      <tr key={row.city} className="border-b border-white/5">
                        <td className="py-2">{row.city}</td>
                        <td className="py-2 text-right tabular-nums">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="rounded-xl border border-white/5 bg-bg-card p-5">
              <h2 className="text-lg font-medium">Review volume by status</h2>
              {data.reviewVolume.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">No reviews yet.</p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-text-secondary">
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 text-right font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reviewVolume.map((row) => (
                      <tr key={row.status} className="border-b border-white/5">
                        <td className="py-2 capitalize">{row.status}</td>
                        <td className="py-2 text-right tabular-nums">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
