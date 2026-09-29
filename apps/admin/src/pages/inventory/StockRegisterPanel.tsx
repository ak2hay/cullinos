import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { csvRow } from '@cullinos/shared';
import { Button, Card, CardHeader, Input } from '@cullinos/ui';
import { inventoryApi, organizationsApi, type StockRegisterRow } from '@/lib/api';

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local-midnight range covering both dates (inclusive), as ISO instants. */
function dayRange(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, ''));

function downloadCsv(rows: StockRegisterRow[], fromDate: string, toDate: string) {
  const header = [
    'Item',
    'SKU',
    'Unit',
    'Opening',
    'Received',
    'Sold / poured',
    'Wasted',
    'Transferred out',
    'Closing',
    'Closing value (INR)',
  ];
  const lines = [
    csvRow(header),
    ...rows.map((r) =>
      csvRow([
        r.name,
        r.sku ?? '',
        r.unit,
        fmt(r.opening),
        fmt(r.received),
        fmt(r.sold),
        fmt(r.wasted),
        fmt(r.transferredOut),
        fmt(r.closing),
        r.closingValue.toFixed(2),
      ]),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock-register_${fromDate}_${toDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function StockRegisterPanel({ outletId }: { outletId?: string | null }) {
  const orgQuery = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
  });
  const [fromDate, setFromDate] = useState(todayIso);
  const [toDate, setToDate] = useState(todayIso);
  const [liquidOverride, setLiquidOverride] = useState<boolean | null>(null);
  const liquidOnly = liquidOverride ?? orgQuery.data?.businessType === 'bar';

  const validRange = Boolean(fromDate && toDate && fromDate <= toDate);
  const registerQuery = useQuery({
    queryKey: ['inventory', 'stock-register', fromDate, toDate, outletId, liquidOnly],
    queryFn: () =>
      inventoryApi.stockRegister({
        ...dayRange(fromDate, toDate),
        outletId: outletId ?? undefined,
        liquidOnly,
      }),
    enabled: validRange,
  });
  const rows = registerQuery.data?.rows ?? [];
  const totalValue = rows.reduce((sum, r) => sum + r.closingValue, 0);

  return (
    <Card>
      <CardHeader
        title="Stock register"
        description="Opening, received, sold, wasted and closing stock per item — use it as your liquor register. Sales deduct stock through recipes (e.g. a 30 mL peg)."
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input
          label="From"
          type="date"
          value={fromDate}
          max={toDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <Input
          label="To"
          type="date"
          value={toDate}
          min={fromDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <label className="flex items-center gap-2 pb-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-primary"
            checked={liquidOnly}
            onChange={(e) => setLiquidOverride(e.target.checked)}
          />
          Liquor units only (mL, L, bottles)
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={rows.length === 0}
          onClick={() => downloadCsv(rows, fromDate, toDate)}
        >
          Download CSV
        </Button>
      </div>

      {!validRange ? (
        <p className="text-sm text-status-error">Pick a From date on or before the To date.</p>
      ) : registerQuery.isLoading ? (
        <p className="text-sm text-text-muted">Loading register…</p>
      ) : registerQuery.error ? (
        <p className="text-sm text-status-error">
          {registerQuery.error instanceof Error ? registerQuery.error.message : 'Failed to load register'}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted">
          {liquidOnly
            ? 'No items tracked in mL, L or bottles yet.'
            : 'No inventory items yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 text-right font-medium">Opening</th>
                <th className="px-3 py-2 text-right font-medium">Received</th>
                <th className="px-3 py-2 text-right font-medium">Sold / poured</th>
                <th className="px-3 py-2 text-right font-medium">Wasted</th>
                <th className="px-3 py-2 text-right font-medium">Transferred</th>
                <th className="px-3 py-2 text-right font-medium">Closing</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.inventoryItemId} className="border-b border-white/5">
                  <td className="px-3 py-2 font-medium">
                    {r.name}
                    {r.sku ? <span className="ml-2 text-xs text-text-muted">{r.sku}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{r.unit}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.opening)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.received)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.sold)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.wasted)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.transferredOut)}</td>
                  <td
                    className={`px-3 py-2 text-right font-mono font-semibold ${r.closing < 0 ? 'text-status-error' : ''}`}
                  >
                    {fmt(r.closing)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-text-secondary">
                    ₹{r.closingValue.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={8} className="px-3 py-2 text-right text-text-muted">
                  Closing stock value
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">₹{totalValue.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-2 text-xs text-text-muted">
            Stock edited directly on an item (without an adjustment) isn&apos;t a movement, so it
            can make opening figures look off. Use Adjust stock for counts and corrections.
          </p>
        </div>
      )}
    </Card>
  );
}
