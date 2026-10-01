import { useState } from 'react';
import { Button } from '@cullinos/ui';
import { escapeHtml } from '@/features/pos/printHelper';
import { downloadQr, printHtml, qrDataUrl, useQrDataUrl } from '@/lib/qr';

const GUEST_APP_BASE =
  (import.meta.env.VITE_GUEST_APP_URL as string | undefined) ??
  'https://guest.cullinos.com';

export function guestOutletOrderUrl(orgSlug: string, outletSlug: string): string {
  return `${GUEST_APP_BASE.replace(/\/$/, '')}/o/${encodeURIComponent(orgSlug)}/${encodeURIComponent(outletSlug)}`;
}

/** One ordering QR for the whole outlet. For cafes and counters that do not use tables. */
export function OutletQrCard({
  orgSlug,
  outletSlug,
  outletName,
}: {
  orgSlug?: string | null;
  outletSlug?: string | null;
  outletName?: string | null;
}) {
  const url = orgSlug && outletSlug ? guestOutletOrderUrl(orgSlug, outletSlug) : null;
  const src = useQrDataUrl(url, 240);
  const [copied, setCopied] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const fileSlug = (outletSlug || outletName || 'outlet').replace(/[^\w-]+/g, '_');

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function print() {
    if (!url) return;
    setPrintError(null);
    try {
      const image = await qrDataUrl(url, 480);
      const title = escapeHtml(outletName || 'Order here');
      printHtml(`<!doctype html>
<html><head><title>${title}</title></head>
<body style="font-family:sans-serif;text-align:center;padding:24px">
  <h1 style="font-size:22px;margin:0 0 8px">${title}</h1>
  <p style="margin:0 0 16px">Scan to order</p>
  <img src="${image}" width="280" height="280" alt="Outlet QR" />
</body></html>`);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Could not print the QR');
    }
  }

  return (
    <section className="rounded-xl border border-line-subtle bg-bg-card p-5">
      <h2 className="font-semibold">Outlet QR</h2>
      <p className="mt-1 text-sm text-text-secondary">
        One QR for this restaurant or cafe. Guests scan it to open the menu and order without a
        table.
        {outletName ? ` This code is for ${outletName}.` : ''}
      </p>
      {!url ? (
        <p className="mt-3 text-sm text-text-muted">
          Select an outlet with a public link to generate the QR.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-start gap-5">
          <div className="shrink-0">
            {src ? (
              <img
                src={src}
                alt={outletName ? `${outletName} ordering QR` : 'Outlet ordering QR'}
                width={140}
                height={140}
                className="rounded-xl bg-white p-2"
              />
            ) : (
              <div className="h-[140px] w-[140px] rounded-xl bg-bg-elevated" />
            )}
          </div>
          <div className="min-w-0 space-y-3">
            <code className="block break-all rounded-lg border border-line bg-bg-elevated px-3 py-2 text-xs text-brand-primary">
              {url}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => void downloadQr(url, 800, `${fileSlug}-qr`)}>
                Download QR
              </Button>
              <Button type="button" variant="secondary" onClick={() => void copy()}>
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void print()}>
                Print
              </Button>
            </div>
            {printError ? <p className="text-sm text-status-error">{printError}</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}
