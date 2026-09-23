import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Button, Card, PageShell } from '@cullinos/ui';
import { outletsApi, reportsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

type ReportTab =
  | 'summary'
  | 'items'
  | 'categories'
  | 'payments'
  | 'discounts'
  | 'cancellations'
  | 'food-cost'
  | 'tax';

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
  return [keys.join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))].join('\n');
}

// ── Sortable table ─────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc';

function SortableTable({
  loading,
  error,
  headers,
  rows,
}: {
  loading: boolean;
  error: unknown;
  headers: Array<{ label: string; numeric?: boolean }>;
  rows: string[][];
}) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(i: number) {
    if (sortCol === i) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(i); setSortDir('desc'); }
  }

  const sorted = sortCol === null
    ? rows
    : [...rows].sort((a, b) => {
        const av = a[sortCol] ?? '';
        const bv = b[sortCol] ?? '';
        // strip ₹ and commas for numeric comparison
        const an = parseFloat(av.replace(/[₹,]/g, ''));
        const bn = parseFloat(bv.replace(/[₹,]/g, ''));
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : av.localeCompare(bv);
        return sortDir === 'asc' ? cmp : -cmp;
      });

  if (loading) return <p className="text-text-muted">Loading…</p>;
  if (error) {
    return (
      <p className="text-sm text-status-error">
        {error instanceof Error ? error.message : 'Failed to load report'}
      </p>
    );
  }
  return (
    <section className="overflow-x-auto rounded-xl border border-white/5 bg-bg-card p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-secondary">
            {headers.map((h, i) => (
              <th
                key={h.label}
                className="cursor-pointer select-none pb-2 pr-4 font-medium hover:text-text-primary"
                onClick={() => handleSort(i)}
              >
                <span className="flex items-center gap-1">
                  {h.label}
                  <span className={`text-xs ${sortCol === i ? 'text-brand-primary' : 'text-text-muted'}`}>
                    {sortCol === i ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="py-4 text-text-muted">
                No data for this period.
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr key={i} className="border-t border-white/5">
                {row.map((cell, j) => (
                  <td key={j} className={`py-2 pr-4 ${headers[j]?.numeric ? 'font-mono' : ''}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

// ── Export dropdown ─────────────────────────────────────────────────────────

type ExportType = 'summary-json' | 'orders-csv' | 'orders-json';

const EXPORT_OPTIONS: Array<{ id: ExportType; label: string }> = [
  { id: 'summary-json', label: 'Summary JSON' },
  { id: 'orders-csv', label: 'Orders CSV' },
  { id: 'orders-json', label: 'Orders JSON' },
];

function ExportFormatSelect({
  value,
  onChange,
}: {
  value: ExportType | '';
  onChange: (type: ExportType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function handleBlur(e: React.FocusEvent) {
    if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
  }

  const selectedLabel =
    EXPORT_OPTIONS.find((o) => o.id === value)?.label ?? 'Select format';

  return (
    <div ref={ref} className="relative" onBlur={handleBlur}>
      <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)}>
        {selectedLabel} ▾
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-xl border border-white/10 bg-bg-card shadow-xl">
          {EXPORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="block w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 first:rounded-t-xl last:rounded-b-xl"
              onClick={() => {
                setOpen(false);
                onChange(opt.id);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export function ReportsPage() {
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const [tab, setTab] = useState<ReportTab>('summary');
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [outletId, setOutletId] = useState(selectedOutletId ?? '');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportType, setExportType] = useState<ExportType | ''>('');

  const rangeParams = { from: from || undefined, to: to || undefined, outletId: outletId || undefined };

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });

  const summaryQuery = useQuery({
    queryKey: ['reports', 'smb', from, outletId],
    queryFn: () => reportsApi.smbSummary({ date: from || undefined, outletId: outletId || undefined }),
    enabled: tab === 'summary',
  });

  const itemsQuery = useQuery({
    queryKey: ['reports', 'items', from, to, outletId],
    queryFn: () => reportsApi.items(rangeParams),
    enabled: tab === 'items',
  });

  const categoriesQuery = useQuery({
    queryKey: ['reports', 'categories', from, to, outletId],
    queryFn: () => reportsApi.categories(rangeParams),
    enabled: tab === 'categories',
  });

  const paymentsQuery = useQuery({
    queryKey: ['reports', 'payments', from, to, outletId],
    queryFn: () => reportsApi.paymentMethods(rangeParams),
    enabled: tab === 'payments',
  });

  const discountsQuery = useQuery({
    queryKey: ['reports', 'discounts', from, to, outletId],
    queryFn: () => reportsApi.discounts(rangeParams),
    enabled: tab === 'discounts',
  });

  const cancellationsQuery = useQuery({
    queryKey: ['reports', 'cancellations', from, to, outletId],
    queryFn: () => reportsApi.cancellations(rangeParams),
    enabled: tab === 'cancellations',
  });

  const foodCostQuery = useQuery({
    queryKey: ['reports', 'food-cost', from, to, outletId],
    queryFn: () => reportsApi.foodCost(rangeParams),
    enabled: tab === 'food-cost',
  });

  const taxCollectionQuery = useQuery({
    queryKey: ['reports', 'tax-collection', from, to, outletId],
    queryFn: () => reportsApi.taxCollection(rangeParams),
    enabled: tab === 'tax',
  });

  const salesByTaxGroupQuery = useQuery({
    queryKey: ['reports', 'sales-by-tax-group', from, to, outletId],
    queryFn: () => reportsApi.salesByTaxGroup(rangeParams),
    enabled: tab === 'tax',
  });

  const data = summaryQuery.data;

  async function handleExport(type: ExportType) {
    setExporting(true);
    setExportError(null);
    try {
      if (type === 'summary-json') {
        if (!data) {
          setExportError('Load the Daily summary tab before exporting Summary JSON.');
          return;
        }
        downloadBlob(
          `smb-summary-${from || 'today'}.json`,
          JSON.stringify(data, null, 2),
          'application/json',
        );
        return;
      }
      const result = await reportsApi.export({
        from: from || undefined,
        to: to || undefined,
        outletId: outletId || undefined,
      });
      const stamp = `${result.from}_${result.to}`;
      if (type === 'orders-json') {
        downloadBlob(`orders-${stamp}.json`, JSON.stringify(result, null, 2), 'application/json');
      } else {
        downloadBlob(`orders-${stamp}.csv`, rowsToCsv(result.rows), 'text/csv;charset=utf-8');
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  // Quick presets
  function applyPreset(days: number) {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - (days - 1));
    setFrom(f.toISOString().slice(0, 10));
    setTo(t.toISOString().slice(0, 10));
  }

  const tabs: Array<{ id: ReportTab; label: string }> = [
    { id: 'summary', label: 'Daily summary' },
    { id: 'items', label: 'Item-wise' },
    { id: 'categories', label: 'Category' },
    { id: 'payments', label: 'Payment methods' },
    { id: 'discounts', label: 'Discounts' },
    { id: 'cancellations', label: 'Cancellations' },
    { id: 'food-cost', label: 'Food cost' },
    { id: 'tax', label: 'Tax' },
  ];

  return (
    <PageShell
      title="Reports"
      description="Sales summaries, item performance, payments, discounts, and cancellations."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ExportFormatSelect value={exportType} onChange={setExportType} />
          <Button
            type="button"
            loading={exporting}
            disabled={!exportType}
            onClick={() => {
              if (exportType) void handleExport(exportType);
            }}
          >
            Export
          </Button>
        </div>
      }
    >
      {exportError ? <p className="text-sm text-status-error">{exportError}</p> : null}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-white/5 bg-bg-card p-4">
        <label className="space-y-1 text-sm">
          <span className="text-text-secondary">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="block h-11 rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text-secondary">To</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
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
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          {[
            { label: 'Today', days: 1 },
            { label: '7 days', days: 7 },
            { label: '30 days', days: 30 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset.days)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-text-secondary hover:bg-white/5 hover:text-text-primary transition"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              tab === t.id
                ? 'bg-brand-primary/15 font-medium text-brand-primary'
                : 'text-text-secondary hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Summary tab ── */}
      {tab === 'summary' ? (
        summaryQuery.isLoading ? (
          <p className="text-text-muted">Loading…</p>
        ) : summaryQuery.error ? (
          <p className="text-sm text-status-error">
            {summaryQuery.error instanceof Error ? summaryQuery.error.message : 'Failed to load report'}
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Revenue" value={`₹${Number(data?.revenue ?? 0).toFixed(0)}`} />
              <StatCard label="Orders" value={String(data?.orderCount ?? 0)} />
              <StatCard label="Avg order" value={`₹${Number(data?.averageOrderValue ?? 0).toFixed(0)}`} />
              <StatCard label="Tips" value={`₹${Number(data?.tips ?? 0).toFixed(0)}`} />
            </div>
            <section className="rounded-xl border border-white/5 bg-bg-card p-4">
              <h2 className="font-semibold">Top items</h2>
              <ul className="mt-3 space-y-1 text-sm text-text-secondary">
                {((data?.topItems as Array<{ name: string; quantity: number }>) ?? []).map(
                  (item) => (
                    <li key={item.name}>
                      {item.name} — {item.quantity} sold
                    </li>
                  ),
                )}
              </ul>
            </section>
          </>
        )
      ) : null}

      {/* ── Items tab ── */}
      {tab === 'items' ? (
        <SortableTable
          loading={itemsQuery.isLoading}
          error={itemsQuery.error}
          headers={[{ label: 'Item' }, { label: 'Qty', numeric: true }, { label: 'Revenue', numeric: true }]}
          rows={(itemsQuery.data?.items ?? []).map((i) => [
            i.name,
            String(i.quantity),
            `₹${i.revenue.toFixed(0)}`,
          ])}
        />
      ) : null}

      {/* ── Categories tab ── */}
      {tab === 'categories' ? (
        <SortableTable
          loading={categoriesQuery.isLoading}
          error={categoriesQuery.error}
          headers={[{ label: 'Category' }, { label: 'Qty', numeric: true }, { label: 'Revenue', numeric: true }]}
          rows={(categoriesQuery.data?.categories ?? []).map((c) => [
            c.category,
            String(c.quantity),
            `₹${c.revenue.toFixed(0)}`,
          ])}
        />
      ) : null}

      {/* ── Payments tab ── */}
      {tab === 'payments' ? (
        <SortableTable
          loading={paymentsQuery.isLoading}
          error={paymentsQuery.error}
          headers={[{ label: 'Method' }, { label: 'Count', numeric: true }, { label: 'Amount', numeric: true }]}
          rows={(paymentsQuery.data?.methods ?? []).map((m) => [
            m.method,
            String(m.count),
            `₹${m.amount.toFixed(0)}`,
          ])}
        />
      ) : null}

      {/* ── Discounts tab ── */}
      {tab === 'discounts' ? (
        <div className="space-y-4">
          {discountsQuery.data ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Discount orders" value={String(discountsQuery.data.orderCount)} />
              <StatCard label="Total discount" value={`₹${discountsQuery.data.totalDiscount.toFixed(0)}`} />
            </div>
          ) : null}
          <SortableTable
            loading={discountsQuery.isLoading}
            error={discountsQuery.error}
            headers={[{ label: 'Type' }, { label: 'Count', numeric: true }, { label: 'Amount', numeric: true }]}
            rows={(discountsQuery.data?.byType ?? []).map((d) => [
              d.type,
              String(d.count),
              `₹${d.amount.toFixed(0)}`,
            ])}
          />
        </div>
      ) : null}

      {/* ── Cancellations tab ── */}
      {tab === 'cancellations' ? (
        <div className="space-y-4">
          {cancellationsQuery.data ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Cancelled / voided" value={String(cancellationsQuery.data.count)} />
              <StatCard label="Lost revenue" value={`₹${cancellationsQuery.data.lostRevenue.toFixed(0)}`} />
            </div>
          ) : null}
          <SortableTable
            loading={cancellationsQuery.isLoading}
            error={cancellationsQuery.error}
            headers={[{ label: 'Order' }, { label: 'Status' }, { label: 'Total', numeric: true }]}
            rows={(cancellationsQuery.data?.orders ?? []).map((o) => [
              String((o as Record<string, unknown>).orderNumber ?? (o as Record<string, unknown>).id),
              String((o as Record<string, unknown>).status),
              `₹${Number((o as Record<string, unknown>).total ?? 0).toFixed(0)}`,
            ])}
          />
        </div>
      ) : null}

      {/* ── Food cost tab ── */}
      {tab === 'food-cost' ? (
        <SortableTable
          loading={foodCostQuery.isLoading}
          error={foodCostQuery.error}
          headers={[
            { label: 'Item' },
            { label: 'Qty sold', numeric: true },
            { label: 'Revenue', numeric: true },
            { label: 'Ingredient cost', numeric: true },
            { label: 'Food cost %', numeric: true },
          ]}
          rows={(foodCostQuery.data?.items ?? []).map((i) => [
            i.name,
            String(i.qtySold),
            `₹${i.revenue.toFixed(0)}`,
            `₹${i.ingredientCost.toFixed(0)}`,
            `${i.foodCostPct.toFixed(1)}%`,
          ])}
        />
      ) : null}

      {/* ── Tax tab ── */}
      {tab === 'tax' ? (
        <div className="space-y-6">
          {taxCollectionQuery.data ? (
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="CGST" value={`₹${taxCollectionQuery.data.totals.cgst.toFixed(2)}`} />
              <StatCard label="SGST" value={`₹${taxCollectionQuery.data.totals.sgst.toFixed(2)}`} />
              <StatCard label="IGST" value={`₹${taxCollectionQuery.data.totals.igst.toFixed(2)}`} />
              <StatCard label="Excise" value={`₹${taxCollectionQuery.data.totals.excise.toFixed(2)}`} />
              <StatCard label="Other" value={`₹${taxCollectionQuery.data.totals.other.toFixed(2)}`} />
              <StatCard label="Total tax" value={`₹${taxCollectionQuery.data.totals.total.toFixed(2)}`} />
            </div>
          ) : null}
          <div>
            <h3 className="mb-2 text-sm font-medium text-text-secondary">Tax collection (date-wise)</h3>
            <SortableTable
              loading={taxCollectionQuery.isLoading}
              error={taxCollectionQuery.error}
              headers={[
                { label: 'Date' },
                { label: 'CGST', numeric: true },
                { label: 'SGST', numeric: true },
                { label: 'IGST', numeric: true },
                { label: 'Excise', numeric: true },
                { label: 'Total', numeric: true },
              ]}
              rows={(taxCollectionQuery.data?.days ?? []).map((d) => [
                d.date,
                `₹${d.cgst.toFixed(2)}`,
                `₹${d.sgst.toFixed(2)}`,
                `₹${d.igst.toFixed(2)}`,
                `₹${d.excise.toFixed(2)}`,
                `₹${d.total.toFixed(2)}`,
              ])}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-text-secondary">Sales by tax group</h3>
            <SortableTable
              loading={salesByTaxGroupQuery.isLoading}
              error={salesByTaxGroupQuery.error}
              headers={[
                { label: 'Tax group' },
                { label: 'Qty', numeric: true },
                { label: 'Revenue', numeric: true },
                { label: 'Tax', numeric: true },
              ]}
              rows={(salesByTaxGroupQuery.data?.groups ?? []).map((g) => [
                g.taxGroupName,
                String(g.quantity),
                `₹${g.revenue.toFixed(2)}`,
                `₹${g.tax.toFixed(2)}`,
              ])}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              const days = taxCollectionQuery.data?.days ?? [];
              const groups = salesByTaxGroupQuery.data?.groups ?? [];
              downloadBlob(
                `tax-collection-${from}_${to}.csv`,
                rowsToCsv(days as unknown as Array<Record<string, unknown>>),
                'text/csv;charset=utf-8',
              );
              downloadBlob(
                `sales-by-tax-group-${from}_${to}.csv`,
                rowsToCsv(groups as unknown as Array<Record<string, unknown>>),
                'text/csv;charset=utf-8',
              );
            }}
          >
            Export tax CSVs
          </Button>
        </div>
      ) : null}
    </PageShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="relative overflow-hidden">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{value}</p>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-brand-primary/0 via-brand-primary/50 to-brand-primary/0" />
    </Card>
  );
}
