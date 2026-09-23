import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { organizationsApi, outletsApi, promoDisplayApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const KDS_BASE =
  (import.meta.env.VITE_KDS_URL as string | undefined) ??
  (import.meta.env.PROD ? 'https://kds.cullinos.com' : 'http://localhost:5174');

export function PromoDisplayPage() {
  const queryClient = useQueryClient();
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const [outletId, setOutletId] = useState(selectedOutletId ?? '');
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    slideType: 'offer',
    durationSeconds: '10',
  });

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const orgQuery = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
  });

  const slidesQuery = useQuery({
    queryKey: ['promo-display', outletId],
    queryFn: () => promoDisplayApi.list(outletId),
    enabled: !!outletId,
  });

  const outlet = outletsQuery.data?.find((o) => o.id === outletId);
  const orgSlug = orgQuery.data?.slug;

  const createMutation = useMutation({
    mutationFn: promoDisplayApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['promo-display'] });
      setForm({ title: '', subtitle: '', imageUrl: '', slideType: 'offer', durationSeconds: '10' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: promoDisplayApi.remove,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['promo-display'] }),
  });

  const playlistUrl =
    orgSlug && outlet?.slug
      ? `${KDS_BASE.replace(/\/$/, '')}/?mode=playlist&orgSlug=${encodeURIComponent(orgSlug)}&outletSlug=${encodeURIComponent(outlet.slug)}`
      : null;

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    createMutation.mutate({
      outletId,
      title: form.title || undefined,
      subtitle: form.subtitle || undefined,
      imageUrl: form.imageUrl || undefined,
      slideType: form.slideType,
      durationSeconds: Number(form.durationSeconds),
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Digital promo display</h1>
        <p className="mt-1 text-text-secondary">
          Manage menu and offer slides for CDS playlist mode on in-store TVs.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 rounded-xl border border-white/5 bg-bg-card p-4">
        <label className="space-y-1 text-sm">
          <span className="text-text-secondary">Outlet</span>
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
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
        {playlistUrl ? (
          <div className="flex items-end gap-2">
            <Button type="button" onClick={() => void navigator.clipboard.writeText(playlistUrl)}>
              Copy playlist URL
            </Button>
            <a
              href={playlistUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center rounded-lg border border-white/10 px-4 text-sm hover:bg-white/5"
            >
              Open preview
            </a>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-4 rounded-xl border border-white/5 bg-bg-card p-6 md:grid-cols-2"
      >
        <h2 className="font-medium md:col-span-2">Add slide</h2>
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <Input
          label="Subtitle"
          value={form.subtitle}
          onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
        />
        <Input
          label="Image URL"
          value={form.imageUrl}
          onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
        />
        <label className="block text-sm">
          <span className="mb-1.5 block text-text-secondary">Type</span>
          <select
            value={form.slideType}
            onChange={(e) => setForm((f) => ({ ...f, slideType: e.target.value }))}
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
          value={form.durationSeconds}
          onChange={(e) => setForm((f) => ({ ...f, durationSeconds: e.target.value }))}
        />
        <div className="md:col-span-2">
          <Button type="submit" loading={createMutation.isPending} disabled={!outletId}>
            Add slide
          </Button>
        </div>
      </form>

      <section className="rounded-xl border border-white/5 bg-bg-card p-6">
        <h2 className="mb-4 font-medium">Slides</h2>
        {(slidesQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">No slides yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {(slidesQuery.data ?? []).map((slide) => (
              <li key={slide.id} className="flex items-center justify-between gap-4 py-3 text-sm">
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
                  onClick={() => removeMutation.mutate(slide.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
