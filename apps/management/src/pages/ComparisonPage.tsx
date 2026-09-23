import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BarChart } from '@/components/charts/BarChart';
import { analyticsApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';

export function ComparisonPage() {
  const brandId = useAuthStore((s) => s.selectedBrandId);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [city, setCity] = useState('');
  const [zone, setZone] = useState('');
  const [state, setState] = useState('');

  const filtersQuery = useQuery({
    queryKey: ['analytics', 'geo-filters', brandId],
    queryFn: () => analyticsApi.outletGeoFilters({ brandId: brandId ?? undefined }),
  });

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['analytics', 'outlet-comparison', brandId, date, city, zone, state],
    queryFn: () =>
      analyticsApi.outletComparison({
        brandId: brandId ?? undefined,
        date: date || undefined,
        city: city || undefined,
        zone: zone || undefined,
        state: state || undefined,
      }),
    retry: false,
  });

  const revenueBars = data.map((row) => ({
    label: row.outletName,
    value: row.revenue,
    displayValue: formatMoney(row.revenue),
  }));

  const orderBars = data.map((row) => ({
    label: row.outletName,
    value: row.orders,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Outlet comparison</h1>
        <p className="mt-1 text-text-secondary">
          Compare revenue and order volume across outlets — filter by city, zone, or state.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 rounded-xl border border-white/5 bg-bg-card p-4">
        <label className="space-y-1 text-sm">
          <span className="text-text-secondary">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="block h-11 rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
          />
        </label>
        <FilterSelect
          label="City"
          value={city}
          options={filtersQuery.data?.cities ?? []}
          onChange={setCity}
        />
        <FilterSelect
          label="Zone"
          value={zone}
          options={filtersQuery.data?.zones ?? []}
          onChange={setZone}
        />
        <FilterSelect
          label="State"
          value={state}
          options={filtersQuery.data?.states ?? []}
          onChange={setState}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          Outlet comparison API unavailable — showing placeholder when endpoints are not yet deployed.
        </div>
      ) : null}

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-bg-card" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-white/5 bg-bg-card p-6">
            <h2 className="mb-4 font-medium">Revenue by outlet</h2>
            <BarChart items={revenueBars} valueLabel="Revenue (INR)" />
          </section>
          <section className="rounded-xl border border-white/5 bg-bg-card p-6">
            <h2 className="mb-4 font-medium">Orders by outlet</h2>
            <BarChart items={orderBars} valueLabel="Order count" colorClass="bg-brand-accent" />
          </section>
        </div>
      )}

      {data.length > 0 ? (
        <section className="overflow-x-auto rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="mb-4 font-medium">Outlet details</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="pb-2 pr-4">Outlet</th>
                <th className="pb-2 pr-4">City</th>
                <th className="pb-2 pr-4">Zone</th>
                <th className="pb-2 pr-4">State</th>
                <th className="pb-2 pr-4">Orders</th>
                <th className="pb-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.outletId} className="border-t border-white/5">
                  <td className="py-2 pr-4">{row.outletName}</td>
                  <td className="py-2 pr-4">{row.city ?? '—'}</td>
                  <td className="py-2 pr-4">{row.zone ?? '—'}</td>
                  <td className="py-2 pr-4">{row.state ?? '—'}</td>
                  <td className="py-2 pr-4">{row.orders}</td>
                  <td className="py-2">{formatMoney(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-text-secondary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block h-11 min-w-[140px] rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
