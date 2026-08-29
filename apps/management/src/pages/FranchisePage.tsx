import { useQuery } from '@tanstack/react-query';
import { franchiseApi } from '@/lib/api';

export function FranchisePage() {
  const { data: franchisees = [], isLoading, error } = useQuery({
    queryKey: ['franchise', 'franchisees'],
    queryFn: franchiseApi.listFranchisees,
    retry: false,
  });

  const activeCount = franchisees.filter((f) => f.status === 'ACTIVE').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Franchise overview</h1>
        <p className="mt-1 text-text-secondary">
          Monitor franchisees, agreements, and outlet coverage across your brand.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-bg-card p-5">
          <p className="text-sm text-text-muted">Total franchisees</p>
          <p className="mt-2 text-2xl font-semibold">{isLoading ? '…' : franchisees.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-bg-card p-5">
          <p className="text-sm text-text-muted">Active</p>
          <p className="mt-2 text-2xl font-semibold text-status-success">
            {isLoading ? '…' : activeCount}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-bg-card p-5">
          <p className="text-sm text-text-muted">Total outlets</p>
          <p className="mt-2 text-2xl font-semibold">
            {isLoading ? '…' : franchisees.reduce((sum, f) => sum + f.outletCount, 0)}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          Franchise API unavailable — data will appear when endpoints are connected.
        </div>
      ) : null}

      <section className="rounded-xl border border-white/5 bg-bg-card p-6">
        <h2 className="font-medium">Franchisees</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-text-muted">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Contact</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Outlets</th>
                <th className="pb-3 font-medium">Agreements</th>
              </tr>
            </thead>
            <tbody>
              {franchisees.map((f) => (
                <tr key={f.id} className="border-b border-white/5">
                  <td className="py-3 pr-4 font-medium">{f.name}</td>
                  <td className="py-3 pr-4 text-text-secondary">
                    {f.contactEmail ?? f.contactPhone ?? '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        f.status === 'ACTIVE'
                          ? 'bg-status-success/15 text-status-success'
                          : 'bg-status-warning/15 text-status-warning'
                      }`}
                    >
                      {f.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{f.outletCount}</td>
                  <td className="py-3">{f.agreementCount}</td>
                </tr>
              ))}
              {!isLoading && franchisees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-text-muted">
                    No franchisees registered yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
