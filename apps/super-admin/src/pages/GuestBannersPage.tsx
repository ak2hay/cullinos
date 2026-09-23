import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { superAdminApi, type GuestBannerRow } from '@/lib/api';

type FormState = {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkType: 'none' | 'outlet' | 'url';
  linkValue: string;
  sortOrder: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  title: '',
  subtitle: '',
  imageUrl: '',
  linkType: 'none',
  linkValue: '',
  sortOrder: '0',
  startsAt: '',
  endsAt: '',
  isActive: true,
};

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function payloadFromForm(form: FormState) {
  const linkPayload =
    form.linkType === 'outlet'
      ? { outletId: form.linkValue.trim() }
      : form.linkType === 'url'
        ? { url: form.linkValue.trim() }
        : {};
  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    imageUrl: form.imageUrl.trim() || null,
    linkType: form.linkType,
    linkPayload,
    sortOrder: Number(form.sortOrder) || 0,
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
    isActive: form.isActive,
  };
}

export function GuestBannersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['super-admin', 'guest-banners'],
    queryFn: superAdminApi.listGuestBanners,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = payloadFromForm(form);
      if (!payload.title) throw new Error('Title is required');
      if (editingId) return superAdminApi.updateGuestBanner(editingId, payload);
      return superAdminApi.createGuestBanner(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'guest-banners'] });
      setForm(EMPTY);
      setEditingId(null);
      setMessage(editingId ? 'Platform banner updated.' : 'Platform banner created.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deleteGuestBanner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'guest-banners'] });
      setMessage('Banner deleted.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  function startEdit(b: GuestBannerRow) {
    const payload = (b.linkPayload ?? {}) as Record<string, unknown>;
    setEditingId(b.id);
    setForm({
      title: b.title,
      subtitle: b.subtitle ?? '',
      imageUrl: b.imageUrl ?? '',
      linkType: b.linkType === 'outlet' || b.linkType === 'url' ? b.linkType : 'none',
      linkValue:
        b.linkType === 'outlet'
          ? String(payload.outletId ?? '')
          : b.linkType === 'url'
            ? String(payload.url ?? '')
            : '',
      sortOrder: String(b.sortOrder ?? 0),
      startsAt: toDatetimeLocal(b.startsAt),
      endsAt: toDatetimeLocal(b.endsAt),
      isActive: b.isActive,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Banners (platform)</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Global carousel slides shown to all Cullinos App users, ahead of restaurant-scoped
          banners.
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="text-lg font-medium">{editingId ? 'Edit banner' : 'New platform banner'}</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <Input
            label="Subtitle"
            value={form.subtitle}
            onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <Input
              label="Image URL"
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            />
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Link type</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={form.linkType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  linkType: e.target.value as FormState['linkType'],
                }))
              }
            >
              <option value="none">None</option>
              <option value="outlet">Outlet ID</option>
              <option value="url">External URL</option>
            </select>
          </label>
          {form.linkType !== 'none' ? (
            <Input
              label={form.linkType === 'outlet' ? 'Outlet ID' : 'URL'}
              value={form.linkValue}
              onChange={(e) => setForm((f) => ({ ...f, linkValue: e.target.value }))}
            />
          ) : (
            <div />
          )}
          <Input
            label="Sort order"
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>
          <Input
            label="Starts at"
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
          />
          <Input
            label="Ends at"
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
          />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {editingId ? 'Save changes' : 'Create banner'}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="text-lg font-medium">Platform banners</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : banners.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No platform banners yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {banners.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {b.title}
                    {!b.isActive ? (
                      <span className="ml-2 text-xs text-status-warning">Inactive</span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-text-secondary">
                    {b.subtitle || 'No subtitle'} · sort {b.sortOrder}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => startEdit(b)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm('Delete this banner?')) deleteMutation.mutate(b.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
