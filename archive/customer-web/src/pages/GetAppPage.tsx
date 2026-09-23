import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BrandWordmark } from '@cullinos/ui';
import { DEFAULT_API_BASE } from '@cullinos/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;
const GUEST_APP_HOST =
  import.meta.env.VITE_GUEST_APP_URL ?? 'https://guest.cullinos.com';
const PLAY_STORE_FALLBACK =
  import.meta.env.VITE_GUEST_PLAY_STORE_URL ??
  'https://play.google.com/store/apps/details?id=com.cullinos.guest';

/**
 * Download-first landing for table QR scans when the Guest app may be missing.
 * Query: org, outlet, table?, session?
 */
export function GetAppPage() {
  const [params] = useSearchParams();
  const org = (params.get('org') ?? params.get('orgSlug') ?? '').trim();
  const outlet = (params.get('outlet') ?? params.get('outletSlug') ?? '').trim();
  const table = (params.get('table') ?? '').trim();
  const session = (params.get('session') ?? '').trim();
  const [playStoreUrl, setPlayStoreUrl] = useState(PLAY_STORE_FALLBACK);
  const [triedOpen, setTriedOpen] = useState(false);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (table) q.set('table', table);
    if (session) q.set('session', session);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [table, session]);

  const browserUrl =
    org && outlet ? `/${org}/${outlet}${query}` : '/';

  const appHttpsUrl =
    org && outlet
      ? `${GUEST_APP_HOST.replace(/\/$/, '')}/o/${encodeURIComponent(org)}/${encodeURIComponent(outlet)}${query}`
      : `${GUEST_APP_HOST.replace(/\/$/, '')}/`;

  const appSchemeUrl =
    org && outlet
      ? `cullinos://outlet/${encodeURIComponent(org)}/${encodeURIComponent(outlet)}${query}`
      : 'cullinos://outlet';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/marketplace/app-config`);
        if (!res.ok) return;
        const body = (await res.json()) as { playStoreUrl?: string | null };
        if (!cancelled && body.playStoreUrl) {
          setPlayStoreUrl(body.playStoreUrl);
        }
      } catch {
        // keep fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Attempt custom-scheme open once; stay on this page if the app is missing.
    setTriedOpen(true);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = appSchemeUrl;
    document.body.appendChild(iframe);
    const t = window.setTimeout(() => iframe.remove(), 1500);
    return () => {
      window.clearTimeout(t);
      iframe.remove();
    };
  }, [appSchemeUrl]);

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary text-text-primary">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-6 py-12">
        <BrandWordmark size="lg" className="text-brand-primary" />
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Get the Cullinos app
          </h1>
          <p className="text-sm text-text-secondary">
            {org && outlet
              ? 'Open this restaurant in the app for the best experience — or continue in your browser.'
              : 'Download Cullinos to discover restaurants, order, and earn coins.'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href={playStoreUrl}
            className="flex h-12 items-center justify-center rounded-2xl bg-brand-primary px-5 text-sm font-bold text-bg-primary transition hover:opacity-90"
          >
            Download on Google Play
          </a>
          <a
            href={appHttpsUrl}
            onClick={() => setTriedOpen(true)}
            className="flex h-12 items-center justify-center rounded-2xl border border-white/15 bg-bg-card px-5 text-sm font-semibold transition hover:bg-bg-elevated"
          >
            {triedOpen ? 'Open in app' : 'Opening app…'}
          </a>
          {org && outlet ? (
            <Link
              to={browserUrl}
              className="flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-medium text-text-secondary underline-offset-4 hover:underline"
            >
              Continue in browser
            </Link>
          ) : null}
        </div>

        <p className="text-xs text-text-muted">
          If Google Play is not available yet, ask your restaurant for the official APK or check back soon.
        </p>
      </main>
    </div>
  );
}
