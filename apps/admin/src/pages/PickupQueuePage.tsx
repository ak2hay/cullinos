import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_API_BASE } from '@cullinos/shared';
import { outletsApi } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;

/** Compute the KDS pickup URL.
 *  - In local dev (import.meta.env.DEV) KDS runs on Vite port 5174.
 *  - In production, KDS is served from the same host, e.g. kds.cullinos.com.
 */
function buildPickupUrl(outletId: string): string {
  if (import.meta.env.DEV) {
    return `http://localhost:5174/?outletId=${outletId}&mode=pickup`;
  }
  // Production: KDS lives at /kds/ sub-path of the API host, or its own subdomain
  const base = API_BASE.replace('/api/v1', '');
  return `${base}/kds/?outletId=${outletId}&mode=pickup`;
}

export function PickupQueuePage() {
  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [copied, setCopied] = useState(false);

  const outlets = outletsQuery.data ?? [];
  const outletId = selectedOutletId || outlets[0]?.id;
  const displayUrl = outletId ? buildPickupUrl(outletId) : null;

  function copyUrl() {
    if (!displayUrl) return;
    navigator.clipboard.writeText(displayUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pickup queue</h1>
        <p className="text-sm text-text-secondary">
          Customer-facing order board for counter-service and peak-hour rush. Open this on a
          tablet or TV facing customers — no login required.
        </p>
      </div>

      {outlets.length > 1 && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-secondary">Outlet</label>
          <select
            value={outletId}
            onChange={(e) => setSelectedOutletId(e.target.value)}
            className="rounded-lg border border-white/10 bg-bg-primary px-3 py-2 text-sm"
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      {displayUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <code className="flex-1 break-all rounded-lg border border-white/10 bg-bg-card p-3 text-sm text-brand-primary">
              {displayUrl}
            </code>
            <button
              type="button"
              onClick={copyUrl}
              className="shrink-0 rounded-lg border border-white/10 bg-bg-card px-4 py-2 text-sm text-text-secondary hover:bg-white/5"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <div className="rounded-xl border border-white/5 bg-bg-card p-5 space-y-3">
            <h2 className="font-semibold text-sm">How to set up locally</h2>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-text-secondary">
              <li>Start the API and Admin as usual.</li>
              <li>
                In a separate terminal, run the KDS app:
                <code className="ml-2 rounded bg-white/5 px-2 py-0.5 text-xs text-brand-primary">
                  npm run dev --workspace=apps/kds
                </code>
              </li>
              <li>Open the URL above in a browser tab, tablet, or TV.</li>
              <li>Place a counter / takeaway order via POS or Customer app — it appears in the queue automatically.</li>
            </ol>
            <p className="text-xs text-text-muted">
              In production, the KDS pickup display is served from your KDS domain. No separate login is needed — the display is public-facing.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-text-muted">Loading outlets…</p>
      )}
    </div>
  );
}
