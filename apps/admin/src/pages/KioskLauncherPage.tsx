import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@cullinos/ui';
import { outletsApi, organizationsApi, settingsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const GUEST_APP_BASE =
  (import.meta.env.VITE_GUEST_APP_URL as string | undefined) ??
  'https://guest.cullinos.com';

const KIOSK_APP_BASE =
  (import.meta.env.VITE_KIOSK_APP_URL as string | undefined) ??
  (import.meta.env.PROD ? 'https://kiosk.cullinos.com' : 'http://localhost:5177');

const KDS_BASE =
  (import.meta.env.VITE_KDS_URL as string | undefined) ??
  (import.meta.env.PROD ? 'https://kds.cullinos.com' : 'http://localhost:5174');

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

  if (!outletId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Ordering kiosk</h1>
        <p className="text-text-secondary">Select an outlet to generate ordering links.</p>
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
  const receiptUrl = `${KDS_BASE.replace(/\/$/, '')}/?mode=receipt&outletId=${encodeURIComponent(outletId)}`;

  async function copy(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2500);
  }

  const links = [
    {
      id: 'kiosk',
      title: 'Ordering kiosk',
      description:
        'Open in any tablet browser (full-screen) for in-store self-order. Guests pay at the counter with their pickup code.',
      url: kioskUrl,
    },
    ...(phoneMenuQrEnabled
      ? [
          {
            id: 'menu',
            title: 'Phone menu QR',
            description:
              'Customer phone storefront. Put this URL on a counter/table sticker — orders print on the receipt station.',
            url: menuUrl,
          },
        ]
      : []),
    {
      id: 'receipt',
      title: 'Receipt printer station',
      description:
        'Keep open on the counter PC connected to your mini QR/thermal printer. Auto-prints phone/online order slips.',
      url: receiptUrl,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Digital ordering</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Tablet kiosk{phoneMenuQrEnabled ? ' and phone menu' : ''} for{' '}
          {outlet?.name ?? 'the selected outlet'}. Tickets use a unique 6-character code with QR —
          not another customer status board.
        </p>
      </div>

      <div className="space-y-4">
        {links.map((link) => (
          <section key={link.id} className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="font-semibold">{link.title}</h2>
            <p className="mt-1 text-sm text-text-secondary">{link.description}</p>
            {!link.url ? (
              <p className="mt-2 text-sm text-text-muted">
                {orgQuery.isLoading || outletsQuery.isLoading
                  ? 'Loading…'
                  : 'Organization or outlet slug missing. Complete setup first.'}
              </p>
            ) : (
              <>
                <code className="mt-3 block break-all rounded-lg border border-white/10 bg-bg-elevated p-3 text-sm text-brand-primary">
                  {link.url}
                </code>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void copy(link.id, link.url!)}
                  >
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
        ))}
      </div>
    </div>
  );
}
