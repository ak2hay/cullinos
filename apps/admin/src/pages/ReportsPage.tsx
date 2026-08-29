import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';

export function ReportsPage() {
  const summaryQuery = useQuery({
    queryKey: ['reports', 'smb'],
    queryFn: () => reportsApi.smbSummary(),
  });

  const data = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-text-secondary">Daily sales, peak hours, wastage, and inventory alerts.</p>
      </div>

      {summaryQuery.isLoading ? (
        <p className="text-text-muted">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Revenue" value={`₹${Number(data?.revenue ?? 0).toFixed(0)}`} />
          <StatCard label="Orders" value={String(data?.orderCount ?? 0)} />
          <StatCard label="Avg order" value={`₹${Number(data?.averageOrderValue ?? 0).toFixed(0)}`} />
          <StatCard label="Tips" value={`₹${Number(data?.tips ?? 0).toFixed(0)}`} />
        </div>
      )}

      <section className="rounded-xl border border-white/5 bg-bg-card p-4">
        <h2 className="font-semibold">Top items</h2>
        <ul className="mt-3 space-y-1 text-sm text-text-secondary">
          {((data?.topItems as Array<{ name: string; quantity: number }>) ?? []).map((item) => (
            <li key={item.name}>{item.name} — {item.quantity} sold</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-4">
        <h2 className="font-semibold">Peak hours</h2>
        <ul className="mt-3 space-y-1 text-sm text-text-secondary">
          {((data?.peakHours as Array<{ hour: number; orders: number }>) ?? []).map((h) => (
            <li key={h.hour}>{h.hour}:00 — {h.orders} orders</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-bg-card p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
