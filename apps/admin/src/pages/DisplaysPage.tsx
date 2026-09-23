/**
 * Displays Hub — unified admin page for all in-store display screens.
 *
 * Sections:
 *   1. URL launcher  – KDS, CDS, pickup board, promo playlist
 *   2. Active displays – real-time status table (Device.lastSeenAt within 2 min)
 *   3. Promo slides   – inline CRUD from the former PromoDisplayPage
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { ImageUploadField } from '@/components/ImageUploadField';
import { devicesApi, organizationsApi, outletsApi, promoDisplayApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

// ─── shared URL builder ──────────────────────────────────────────────────────

const KDS_BASE =
  (import.meta.env.VITE_KDS_URL as string | undefined) ??
  (import.meta.env.PROD ? 'https://kds.cullinos.com' : 'http://localhost:5174');

function buildUrl(pathQuery: string) {
  return `${KDS_BASE.replace(/\/$/, '')}/?${pathQuery}`;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1_000;
}

function modeLabel(name: string): string {
  const m = name.replace(/^__display:/, '').replace(/__$/, '');
  const map: Record<string, string> = {
    kds: 'Kitchen Display (KDS)',
    cds: 'Customer Display (CDS)',
    pickup: 'Pickup Board',
    playlist: 'Promo Playlist',
  };
  return map[m] ?? m;
}

function timeSince(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1_000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function CopyOpenRow({
  id,
  title,
  description,
  url,
  copied,
  onCopy,
}: {
  id: string;
  title: string;
  description: string;
  url: string;
  copied: string | null;
  onCopy: (id: string, url: string) => void;
}) {
  return (
    <section className="rounded-xl border border-white/5 bg-bg-card p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
      <code className="mt-3 block break-all rounded-lg border border-white/10 bg-bg-elevated p-3 text-sm text-brand-primary">
        {url}
      </code>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => onCopy(id, url)}>
          {copied === id ? 'Copied ✓' : 'Copy URL'}
        </Button>
        <Button
          type="button"
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        >
          Open in new tab ↗
        </Button>
      </div>
    </section>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export function DisplaysPage() {
  const queryClient = useQueryClient();

  // auth / outlet
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const authOrgSlug = useAuthStore((s) => s.user?.organizationSlug);
  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const orgQuery = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
  });

  // promo slides — local outlet selection (independent of top-bar outlet)
  const [promoOutletId, setPromoOutletId] = useState(outletId ?? '');
  const [copied, setCopied] = useState<string | null>(null);
  const [slideForm, setSlideForm] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    slideType: 'offer',
    durationSeconds: '10',
  });

  // devices — for active displays panel
  const devicesQuery = useQuery({
    queryKey: ['devices', 'virtual'],
    queryFn: () => devicesApi.list({ includeVirtual: true }),
  });

  // promo slides
  const slidesQuery = useQuery({
    queryKey: ['promo-display', promoOutletId],
    queryFn: () => promoDisplayApi.list(promoOutletId),
    enabled: !!promoOutletId,
  });

  const createSlide = useMutation({
    mutationFn: promoDisplayApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['promo-display'] });
      setSlideForm({ title: '', subtitle: '', imageUrl: '', slideType: 'offer', durationSeconds: '10' });
    },
  });

  const removeSlide = useMutation({
    mutationFn: promoDisplayApi.remove,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['promo-display'] }),
  });

  // Derived values
  const outlet = outletsQuery.data?.find((o) => o.id === outletId);
  const outletName = outlet?.name;
  const outletSlug = outlet?.slug;
  const orgSlug = orgQuery.data?.slug ?? authOrgSlug;

  const kitchenUrl = outletId ? buildUrl(`outletId=${encodeURIComponent(outletId)}`) : null;
  const cdsUrl =
    orgSlug && outletSlug
      ? buildUrl(
          `mode=cds&orgSlug=${encodeURIComponent(orgSlug)}&outletSlug=${encodeURIComponent(outletSlug)}`,
        )
      : null;
  const pickupUrl =
    orgSlug && outletSlug
      ? buildUrl(
          `mode=pickup&orgSlug=${encodeURIComponent(orgSlug)}&outletSlug=${encodeURIComponent(outletSlug)}`,
        )
      : null;
  const playlistUrl =
    orgSlug && outletSlug
      ? buildUrl(
          `mode=playlist&orgSlug=${encodeURIComponent(orgSlug)}&outletSlug=${encodeURIComponent(outletSlug)}`,
        )
      : null;

  // Active display devices — virtual rows with name __display:*__
  const displayDevices = (devicesQuery.data ?? [])
    .filter((d) => d.name.startsWith('__display:') && d.outletId)
    .sort((a, b) => {
      const ao = isOnline(a.lastSeenAt) ? 0 : 1;
      const bo = isOnline(b.lastSeenAt) ? 0 : 1;
      return ao - bo;
    });

  // Outlet id→name lookup for the active-displays table
  const outletMap = Object.fromEntries(
    (outletsQuery.data ?? []).map((o) => [o.id, o.name]),
  );

  async function copy(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2500);
  }

  function handleSlideCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!promoOutletId) return;
    createSlide.mutate({
      outletId: promoOutletId,
      title: slideForm.title || undefined,
      subtitle: slideForm.subtitle || undefined,
      imageUrl: slideForm.imageUrl || undefined,
      slideType: slideForm.slideType,
      durationSeconds: Number(slideForm.durationSeconds),
    });
  }

  const loading = outletsQuery.isLoading || orgQuery.isLoading;

  return (
    <div className="space-y-10">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-semibold">Displays</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage KDS, customer-facing boards, and promo playlist screens for{' '}
          <span className="text-text-primary">{outletName ?? 'your outlet'}</span>.
          {' '}KDS base: <code className="text-brand-primary text-xs">{KDS_BASE}</code>
        </p>
      </div>

      {/* ── 1. URL Launcher ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Display URLs</h2>

        {!outletId ? (
          <p className="text-sm text-text-secondary">
            Select an outlet from the top bar to generate display links.
          </p>
        ) : loading ? (
          <p className="text-sm text-text-secondary">Loading outlet details…</p>
        ) : (
          <div className="space-y-4">
            {kitchenUrl && (
              <CopyOpenRow
                id="kds"
                title="Kitchen Display (KDS)"
                description="Staff login required. Shows live KOTs grouped by station."
                url={kitchenUrl}
                copied={copied}
                onCopy={copy}
              />
            )}
            {cdsUrl && (
              <CopyOpenRow
                id="cds"
                title="Customer Display (CDS)"
                description="Public McD-style board — Preparing | Ready columns. Open on a counter TV."
                url={cdsUrl}
                copied={copied}
                onCopy={copy}
              />
            )}
            {pickupUrl && (
              <CopyOpenRow
                id="pickup"
                title="Pickup Board"
                description="Alternate public board via mode=pickup — same data, different layout option."
                url={pickupUrl}
                copied={copied}
                onCopy={copy}
              />
            )}
            {playlistUrl && (
              <CopyOpenRow
                id="playlist"
                title="Promo Playlist"
                description="Rotating menu and offer slides for idle screens. Manage slides below."
                url={playlistUrl}
                copied={copied}
                onCopy={copy}
              />
            )}
            {!orgSlug || !outletSlug ? (
              <p className="text-sm text-amber-400">
                ⚠ Organization or outlet slug is missing — CDS, pickup, and playlist links
                cannot be generated. Ensure the outlet has a slug set in Settings.
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* ── 2. Active Displays ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active displays</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['devices'] })}
          >
            Refresh
          </Button>
        </div>

        {devicesQuery.isLoading ? (
          <p className="text-sm text-text-secondary">Loading devices…</p>
        ) : displayDevices.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-bg-card px-6 py-8 text-center text-sm text-text-secondary">
            No display heartbeats received yet.{' '}
            Open a display URL — it will appear here within 60 seconds.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-text-muted">
                  <th className="px-4 py-3 font-medium">Screen</th>
                  <th className="px-4 py-3 font-medium">Outlet</th>
                  <th className="px-4 py-3 font-medium">Last seen</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayDevices.map((d) => {
                  const online = isOnline(d.lastSeenAt);
                  return (
                    <tr key={d.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 font-medium">{modeLabel(d.name)}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {d.outletId ? (outletMap[d.outletId] ?? d.outletId.slice(-8)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary tabular-nums">
                        {timeSince(d.lastSeenAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            online
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-white/5 text-text-muted'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-white/30'}`}
                          />
                          {online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-text-muted">
          A display is considered online if it sent a heartbeat within the last 2 minutes.
          Heartbeats are sent automatically every 60 seconds by open display tabs.
        </p>
      </section>

      {/* ── 3. Promo Slides ── */}
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Promo playlist slides</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Manage rotating menu and offer slides shown on the promo playlist screen.
          </p>
        </div>

        {/* Outlet picker for slides (may differ from top-bar outlet) */}
        <div className="flex flex-wrap gap-4 rounded-xl border border-white/5 bg-bg-card p-4">
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">Outlet</span>
            <select
              value={promoOutletId}
              onChange={(e) => setPromoOutletId(e.target.value)}
              className="block h-11 min-w-[200px] rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
            >
              <option value="">Select outlet</option>
              {(outletsQuery.data ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Add slide form */}
        <form
          onSubmit={handleSlideCreate}
          className="grid gap-4 rounded-xl border border-white/5 bg-bg-card p-6 md:grid-cols-2"
        >
          <h3 className="font-medium md:col-span-2">Add slide</h3>
          <Input
            label="Title"
            value={slideForm.title}
            onChange={(e) => setSlideForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Input
            label="Subtitle"
            value={slideForm.subtitle}
            onChange={(e) => setSlideForm((f) => ({ ...f, subtitle: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <ImageUploadField
              slot="promoSlide"
              value={slideForm.imageUrl}
              onChange={(url) => setSlideForm((f) => ({ ...f, imageUrl: url }))}
              onUpload={async (file) => {
                const res = await promoDisplayApi.uploadImage(file);
                return res.imageUrl;
              }}
            />
          </div>
          <label className="block text-sm">
            <span className="mb-1.5 block text-text-secondary">Type</span>
            <select
              value={slideForm.slideType}
              onChange={(e) => setSlideForm((f) => ({ ...f, slideType: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
            >
              <option value="offer">Offer</option>
              <option value="menu">Menu highlight</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <Input
            label="Duration (seconds)"
            type="number"
            min={3}
            value={slideForm.durationSeconds}
            onChange={(e) => setSlideForm((f) => ({ ...f, durationSeconds: e.target.value }))}
          />
          <div className="md:col-span-2">
            <Button type="submit" loading={createSlide.isPending} disabled={!promoOutletId}>
              Add slide
            </Button>
          </div>
        </form>

        {/* Slide list */}
        <div className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h3 className="mb-4 font-medium">Slides</h3>
          {!promoOutletId ? (
            <p className="text-sm text-text-secondary">Select an outlet to see slides.</p>
          ) : (slidesQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-text-secondary">No slides yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {(slidesQuery.data ?? []).map((slide) => (
                <li
                  key={slide.id}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{slide.title || '(Untitled)'}</p>
                    <p className="text-text-secondary">
                      {slide.slideType} · {slide.durationSeconds}s
                      {slide.subtitle ? ` · ${slide.subtitle}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeSlide.mutate(slide.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
