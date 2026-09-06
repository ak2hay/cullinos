import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@cullinos/ui';
import { outletsApi, reportsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))].join(
    '\n',
  );
}

export function ReportsPage() {
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [outletId, setOutletId] = useState(selectedOutletId ?? '');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });

  const summaryQuery = useQuery({
    queryKey: ['reports', 'smb', date, outletId],
    queryFn: () =>
      reportsApi.smbSummary({
        date: date || undefined,
        outletId: outletId || undefined,
      }),
  });

  const data = summaryQuery.data;

  async function handleExport(format: 'json' | 'csv') {
    setExporting(true);
    setExportError(null);
    try {
      const result = await reportsApi.export({ from: date || undefined, to: date || undefined });
      const stamp = result.from || date || 'export';
      if (format === 'json') {
        downloadBlob(
          `orders-export-${stamp}.json`,
          JSON.stringify(result, null, 2),
          'application/json',
        );
      } else {
        downloadBlob(
          `orders-export-${stamp}.csv`,
          rowsToCsv(result.rows),
          'text/csv;charset=utf-8',
        );
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  function downloadSummaryJson() {
    if (!data) return;
    downloadBlob(
      `smb-summary-${date || 'today'}.json`,
      JSON.stringify(data, null, 2),
      'application/json',
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-text-secondary">
            Daily sales, peak hours, wastage, and inventory alerts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!data || summaryQuery.isLoading}
            onClick={downloadSummaryJson}
          >
            Download summary JSON
          </Button>
          <Button type="button" loading={exporting} onClick={() => handleExport('csv')}>
            Export orders CSV
          </Button>
          <Button type="button" loading={exporting} onClick={() => handleExport('json')}>
            Export orders JSON
          </Button>
        </div>
      </div>

      {exportError ? <p className="text-sm text-status-error">{exportError}</p> : null}

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
        <label className="space-y-1 text-sm">
          <span className="text-text-secondary">Outlet</span>
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="block h-11 min-w-[180px] rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
          >
            <option value="">All outlets</option>
            {(outletsQuery.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {summaryQuery.isLoading ? (
        <p className="text-text-muted">Loading…</p>
      ) : summaryQuery.error ? (
        <p className="text-sm text-status-error">
          {summaryQuery.error instanceof Error
            ? summaryQuery.error.message
            : 'Failed to load report'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Revenue" value={`₹${Number(data?.revenue ?? 0).toFixed(0)}`} />
          <StatCard label="Orders" value={String(data?.orderCount ?? 0)} />
          <StatCard
            label="Avg order"
            value={`₹${Number(data?.averageOrderValue ?? 0).toFixed(0)}`}
          />
          <StatCard label="Tips" value={`₹${Number(data?.tips ?? 0).toFixed(0)}`} />
        </div>
      )}

      <section className="rounded-xl border border-white/5 bg-bg-card p-4">
        <h2 className="font-semibold">Top items</h2>
        <ul className="mt-3 space-y-1 text-sm text-text-secondary">
          {((data?.topItems as Array<{ name: string; quantity: number }>) ?? []).map((item) => (
            <li key={item.name}>
              {item.name} — {item.quantity} sold
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-4">
        <h2 className="font-semibold">Peak hours</h2>
        <ul className="mt-3 space-y-1 text-sm text-text-secondary">
          {((data?.peakHours as Array<{ hour: number; orders: number }>) ?? []).map((h) => (
            <li key={h.hour}>
              {h.hour}:00 — {h.orders} orders
            </li>
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
