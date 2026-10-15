import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@cullinos/ui';
import { OutletQrCard } from '@/components/ordering/OutletQrCard';
import { outletsApi, organizationsApi, settingsApi } from '@/lib/api';
import { useOutletUsesTables } from '@/lib/outlet-tables';
import { useAuthStore } from '@/stores/auth';

const GUEST_APP_BASE =
  (import.meta.env.VITE_GUEST_APP_URL as string | undefined) ??
  'https://guest.cullinos.com';

const KIOSK_APP_BASE =
  (import.meta.env.VITE_KIOSK_APP_URL as string | undefined) ??
  (import.meta.env.PROD ? 'https://kiosk.cullinos.com' : 'http://localhost:5177');

const PAGE_TITLE = 'Self-order (kiosk & QR)';

type LaunchLink = { id: string; title: string; description: string; url: string | null };

export function KioskLauncherPage() {
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const orgQuery = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
  });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const [copied, setCopied] = useState<string | null>(null);

  const outlet = outletsQuery.data?.find((o) => o.id === outletId);
  const orgSlug = orgQuery.data?.slug;
  const outletSlug = outlet?.slug;
  const phoneMenuQrEnabled =
    settingsQuery.data?.platformCapabilities?.phoneMenuQrEnabled === true;
  const showOutletQr = !useOutletUsesTables(outlet);

  if (!outletId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{PAGE_TITLE}</h1>
        <p className="text-text-secondary">
          Select an outlet to get its self-order kiosk and QR phone menu links.
        </p>
      </div>
    );
  }

  const menuUrl =
    orgSlug && outletSlug
      ? `${GUEST_APP_BASE.replace(/\/$/, '')}/o/${encodeURIComponent(orgSlug)}/${encodeURIComponent(outletSlug)}`
      : null;
  const kioskUrl =
    orgSlug && outletSlug
      ? `${KIOSK_APP_BASE.replace(/\/$/, '')}/o/${encodeURIComponent(orgSlug)}/${encodeURIComponent(outletSlug)}`
      : null;

  async function copy(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2500);
  }

  function renderLink(link: LaunchLink) {
    return (
      <section key={link.id} className="rounded-xl border border-line-subtle bg-bg-card p-5">
        <h3 className="font-semibold">{link.title}</h3>
        <p className="mt-1 text-sm text-text-secondary">{link.description}</p>
        {!link.url ? (
          <p className="mt-2 text-sm text-text-muted">
            {orgQuery.isLoading || outletsQuery.isLoading
              ? 'Loading…'
              : 'Organization or outlet slug missing. Complete setup first.'}
          </p>
        ) : (
          <>
            <code className="mt-3 block break-all rounded-lg border border-line bg-bg-elevated p-3 text-sm text-brand-primary">
              {link.url}
            </code>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => void copy(link.id, link.url!)}>
                {copied === link.id ? 'Copied' : 'Copy'}
              </Button>
              <Button
                type="button"
                onClick={() => window.open(link.url!, '_blank', 'noopener,noreferrer')}
              >
                Open in new tab
              </Button>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{PAGE_TITLE}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Let guests at {outlet?.name ?? 'the selected outlet'} order without staff, on a tablet in
          your store or on their own phone. Each ticket gets a unique 6-character pickup code with QR.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">On a store tablet</h2>
          <p className="text-sm text-text-secondary">A kiosk device you own, placed at the counter or entrance.</p>
        </div>
        {renderLink({
          id: 'kiosk',
          title: 'Self-order kiosk (tablet)',
          description:
            'Open in any tablet browser (full-screen). Guests order on the tablet and pay at the counter with their pickup code.',
          url: kioskUrl,
        })}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">On guests&apos; phones</h2>
          <p className="text-sm text-text-secondary">
            Guests scan a QR code and order from their own phone. No device needed.
          </p>
        </div>
        {showOutletQr ? (
          <OutletQrCard orgSlug={orgSlug} outletSlug={outletSlug} outletName={outlet?.name} />
        ) : null}
        {phoneMenuQrEnabled && !showOutletQr
          ? renderLink({
              id: 'menu',
              title: 'Phone menu QR',
              description:
                'Customer phone storefront. Put this URL on a counter or table sticker. Orders print on the receipt printer station (set it up under Displays).',
              url: menuUrl,
            })
          : null}
        {!showOutletQr ? (
          <p className="text-sm text-text-secondary">
            Table QR codes are on the{' '}
            <Link to="/tables" className="text-brand-primary hover:underline">
              Tables
            </Link>{' '}
            page (Print QR sheet).
          </p>
        ) : null}
      </div>
    </div>
  );
}
