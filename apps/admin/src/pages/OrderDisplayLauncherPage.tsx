import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@cullinos/ui';
import { outletsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const KDS_BASE =
  (import.meta.env.VITE_KDS_URL as string | undefined) ??
  (import.meta.env.PROD ? 'https://kds.cullinos.com' : 'http://localhost:5174');

function buildUrl(pathQuery: string) {
  const base = KDS_BASE.replace(/\/$/, '');
  return `${base}/?${pathQuery}`;
}

export function OrderDisplayLauncherPage() {
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const outletName = outletsQuery.data?.find((o) => o.id === outletId)?.name;
  const [copied, setCopied] = useState<string | null>(null);

  if (!outletId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Customer display</h1>
        <p className="text-text-secondary">Select an outlet to generate CDS / pickup links.</p>
      </div>
    );
  }

  const cdsUrl = buildUrl(`mode=cds&outletId=${encodeURIComponent(outletId)}`);

  async function copy(label: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(label);
    setTimeout(() => setCopied(null), 2500);
  }

  const links = [
    {
      id: 'cds',
      title: 'Customer display (CDS)',
      description: 'McD-style board: huge order numbers, Preparing | Ready. Open on a TV facing customers.',
      url: cdsUrl,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customer display</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Counter / TV order board for {outletName ?? 'the selected outlet'}. No login required.
        </p>
      </div>

      <div className="space-y-4">
        {links.map((link) => (
          <section key={link.id} className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="font-semibold">{link.title}</h2>
            <p className="mt-1 text-sm text-text-secondary">{link.description}</p>
            <code className="mt-3 block break-all rounded-lg border border-white/10 bg-bg-elevated p-3 text-sm text-brand-primary">
              {link.url}
            </code>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => void copy(link.id, link.url)}>
                {copied === link.id ? 'Copied' : 'Copy'}
              </Button>
              <Button type="button" onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}>
                Open in new tab
              </Button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
