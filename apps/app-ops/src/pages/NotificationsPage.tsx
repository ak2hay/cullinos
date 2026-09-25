import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import {
  guestOpsApi,
  NOTIFICATION_FONT_ALLOWLIST,
  STYLE_PRESET_DEFAULTS,
  type GuestOpsPushCampaignRow,
  type PushCreative,
  type StylePreset,
} from '@/lib/api';

type FormState = {
  title: string;
  body: string;
  audience: 'all' | 'marketing_opt_in' | 'city' | 'org';
  filterCity: string;
  filterOrgId: string;
  deepLink: string;
  scheduledAt: string;
  imageUrl: string;
  stylePreset: StylePreset;
  creative: PushCreative;
};

const EMPTY_CREATIVE: PushCreative = {
  titleColor: '#0F0F1A',
  bodyColor: '#3D3D4A',
  bgColor: '#FFFFFF',
  accentColor: '#D4A017',
  fontFamily: 'Inter',
  ctaLabel: 'Open',
};

const EMPTY: FormState = {
  title: '',
  body: '',
  audience: 'all',
  filterCity: '',
  filterOrgId: '',
  deepLink: '',
  scheduledAt: '',
  imageUrl: '',
  stylePreset: 'offer',
  creative: { ...STYLE_PRESET_DEFAULTS.offer },
};

function audienceFilterFromForm(form: FormState): Record<string, unknown> {
  if (form.audience === 'city' && form.filterCity.trim()) {
    return { city: form.filterCity.trim() };
  }
  if (form.audience === 'org' && form.filterOrgId.trim()) {
    return { organizationId: form.filterOrgId.trim() };
  }
  return {};
}

function resolveCreative(form: FormState): PushCreative {
  if (form.stylePreset === 'custom') return form.creative;
  return {
    ...STYLE_PRESET_DEFAULTS[form.stylePreset],
    ...form.creative,
    ctaLabel: form.creative.ctaLabel || STYLE_PRESET_DEFAULTS[form.stylePreset].ctaLabel,
  };
}

function payloadFromForm(form: FormState) {
  const creative = resolveCreative(form);
  return {
    title: form.title.trim(),
    body: form.body.trim(),
    audience: form.audience,
    audienceFilter: audienceFilterFromForm(form),
    deepLink: form.deepLink.trim() || null,
    scheduledAt: form.scheduledAt || null,
    imageUrl: form.imageUrl.trim() || null,
    stylePreset: form.stylePreset,
    creative,
  };
}

function formFromCampaign(row: GuestOpsPushCampaignRow): FormState {
  const filter = (row.audienceFilter ?? {}) as Record<string, unknown>;
  const preset = (row.stylePreset as StylePreset) || 'offer';
  const creative =
    row.creative && typeof row.creative === 'object'
      ? { ...EMPTY_CREATIVE, ...(row.creative as PushCreative) }
      : preset !== 'custom'
        ? { ...STYLE_PRESET_DEFAULTS[preset] }
        : { ...EMPTY_CREATIVE };
  return {
    title: row.title,
    body: row.body,
    audience: (['all', 'marketing_opt_in', 'city', 'org'].includes(row.audience)
      ? row.audience
      : 'all') as FormState['audience'],
    filterCity: typeof filter.city === 'string' ? filter.city : '',
    filterOrgId: typeof filter.organizationId === 'string' ? filter.organizationId : '',
    deepLink: row.deepLink ?? '',
    scheduledAt: row.scheduledAt
      ? new Date(row.scheduledAt).toISOString().slice(0, 16)
      : '',
    imageUrl: row.imageUrl ?? '',
    stylePreset: preset,
    creative,
  };
}

function PhonePreview({ form }: { form: FormState }) {
  const creative = resolveCreative(form);
  const font = creative.fontFamily || 'Inter';

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          System tray
        </p>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1e] text-white shadow-lg">
          <div className="flex gap-3 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-xs font-bold text-bg-primary">
              C
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-white/60">Cullinos · now</p>
              <p className="truncate text-sm font-semibold">
                {form.title.trim() || 'Notification title'}
              </p>
              <p className="line-clamp-2 text-xs text-white/80">
                {form.body.trim() || 'Notification body appears here.'}
              </p>
            </div>
          </div>
          {form.imageUrl ? (
            <img
              src={form.imageUrl}
              alt=""
              className="h-36 w-full object-cover"
            />
          ) : (
            <div className="flex h-24 items-center justify-center bg-white/5 text-xs text-white/40">
              No image
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          In-app card
        </p>
        <div
          className="overflow-hidden rounded-2xl border border-white/10 shadow-lg"
          style={{
            backgroundColor: creative.bgColor || '#fff',
            fontFamily: `"${font}", system-ui, sans-serif`,
          }}
        >
          {form.imageUrl ? (
            <img src={form.imageUrl} alt="" className="h-40 w-full object-cover" />
          ) : null}
          <div className="p-4">
            <p
              className="text-lg font-bold leading-snug"
              style={{
                color: creative.titleColor,
                fontSize: creative.headlineSize ? `${creative.headlineSize}px` : undefined,
              }}
            >
              {form.title.trim() || 'Headline'}
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: creative.bodyColor }}>
              {form.body.trim() || 'Supporting copy for the guest inbox card.'}
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: creative.accentColor || '#D4A017' }}
            >
              {creative.ctaLabel || 'Open'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    creative: { ...STYLE_PRESET_DEFAULTS.offer },
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['guest-ops', 'push-campaigns', statusFilter],
    queryFn: () =>
      guestOpsApi.listPushCampaigns({ status: statusFilter || undefined, limit: '50' }),
  });

  const creative = useMemo(() => resolveCreative(form), [form]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = payloadFromForm(form);
      if (!payload.title || !payload.body) throw new Error('Title and body are required');
      if (editingId) return guestOpsApi.updatePushCampaign(editingId, payload);
      return guestOpsApi.createPushDraft(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'push-campaigns'] });
      setForm({ ...EMPTY, creative: { ...STYLE_PRESET_DEFAULTS.offer } });
      setEditingId(null);
      setMessage(editingId ? 'Campaign saved.' : 'Draft created.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt?: string }) =>
      guestOpsApi.schedulePush(id, scheduledAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'push-campaigns'] });
      setMessage('Campaign scheduled.');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => guestOpsApi.sendPushCampaign(id),
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'push-campaigns'] });
      setMessage(`Sent — ${row.sentCount} guest(s) reached.`);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => guestOpsApi.cancelPush(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'push-campaigns'] });
      setMessage('Campaign cancelled.');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => guestOpsApi.deletePushCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'push-campaigns'] });
      if (editingId) {
        setEditingId(null);
        setForm({ ...EMPTY, creative: { ...STYLE_PRESET_DEFAULTS.offer } });
      }
      setMessage('Campaign deleted.');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  function applyPreset(preset: StylePreset) {
    setForm((f) => ({
      ...f,
      stylePreset: preset,
      creative:
        preset === 'custom'
          ? { ...f.creative }
          : { ...STYLE_PRESET_DEFAULTS[preset], ctaLabel: f.creative.ctaLabel },
    }));
  }

  async function onPickImage(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await guestOpsApi.uploadPushImage(file);
      setForm((f) => ({ ...f, imageUrl: url }));
      setMessage('Image uploaded.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Draft Zomato-style rich push: tray image plus styled in-app cards with fonts, colors, and
          CTAs.
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

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="space-y-5 rounded-xl border border-white/5 bg-bg-card p-5">
          <div className="flex flex-wrap gap-2">
            {(['offer', 'alert', 'promo', 'custom'] as StylePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
                  form.stylePreset === p
                    ? 'bg-brand-primary text-bg-primary'
                    : 'border border-white/10 text-text-secondary hover:bg-white/5'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="₹100 off your next order"
          />
          <label className="block">
            <span className="text-sm text-text-secondary">Body</span>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
              placeholder="Valid today only at participating outlets."
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="CTA label"
              value={creative.ctaLabel ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  creative: { ...f.creative, ctaLabel: e.target.value },
                }))
              }
            />
            <Input
              label="Deep link"
              value={form.deepLink}
              onChange={(e) => setForm((f) => ({ ...f, deepLink: e.target.value }))}
              placeholder="/offers or https://guest.cullinos.com/…"
            />
          </div>

          <div>
            <p className="text-sm text-text-secondary">Hero image</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="ghost"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                Upload image
              </Button>
              {form.imageUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <Input
              label="Or paste image URL"
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            />
          </div>

          {(form.stylePreset === 'custom' || true) && (
            <div className="grid gap-3 rounded-lg border border-white/5 bg-bg-elevated/50 p-4 sm:grid-cols-2">
              <p className="sm:col-span-2 text-sm font-medium">Creative styling</p>
              <label className="block text-sm">
                <span className="text-text-secondary">Font</span>
                <select
                  value={creative.fontFamily || 'Inter'}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      stylePreset: f.stylePreset === 'custom' ? 'custom' : f.stylePreset,
                      creative: { ...f.creative, fontFamily: e.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm"
                >
                  {NOTIFICATION_FONT_ALLOWLIST.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              {(
                [
                  ['titleColor', 'Title color'],
                  ['bodyColor', 'Body color'],
                  ['bgColor', 'Background'],
                  ['accentColor', 'Accent / CTA'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm">
                  <span className="text-text-secondary">{label}</span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="color"
                      value={(creative[key] as string) || '#000000'}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          stylePreset: 'custom',
                          creative: { ...f.creative, [key]: e.target.value },
                        }))
                      }
                      className="h-10 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
                    />
                    <input
                      type="text"
                      value={(creative[key] as string) || ''}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          stylePreset: 'custom',
                          creative: { ...f.creative, [key]: e.target.value },
                        }))
                      }
                      className="flex-1 rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm"
                    />
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-text-secondary">Audience</span>
              <select
                value={form.audience}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    audience: e.target.value as FormState['audience'],
                  }))
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm"
              >
                <option value="all">All guests</option>
                <option value="marketing_opt_in">Marketing opt-in</option>
                <option value="city">City</option>
                <option value="org">Organization</option>
              </select>
            </label>
            <Input
              label="Schedule (optional)"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            />
            {form.audience === 'city' ? (
              <Input
                label="City"
                value={form.filterCity}
                onChange={(e) => setForm((f) => ({ ...f, filterCity: e.target.value }))}
              />
            ) : null}
            {form.audience === 'org' ? (
              <Input
                label="Organization ID"
                value={form.filterOrgId}
                onChange={(e) => setForm((f) => ({ ...f, filterOrgId: e.target.value }))}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {editingId ? 'Save changes' : 'Save draft'}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm({ ...EMPTY, creative: { ...STYLE_PRESET_DEFAULTS.offer } });
                }}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        </section>

        <aside className="rounded-xl border border-white/5 bg-bg-card p-5">
          <h2 className="mb-4 text-lg font-medium">Live preview</h2>
          <PhonePreview form={form} />
        </aside>
      </div>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Campaigns</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sent">Sent</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {isLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No campaigns yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{c.title}</p>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs capitalize text-text-muted">
                      {c.status}
                    </span>
                    {c.stylePreset ? (
                      <span className="rounded-full bg-brand-primary/15 px-2 py-0.5 text-xs capitalize text-brand-primary">
                        {c.stylePreset}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{c.body}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {c.audience} · sent {c.sentCount}
                    {c.imageUrl ? ' · has image' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.status === 'draft' || c.status === 'scheduled' ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(c.id);
                          setForm(formFromCampaign(c));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          scheduleMutation.mutate({
                            id: c.id,
                            scheduledAt: form.scheduledAt || undefined,
                          })
                        }
                      >
                        Schedule
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Send this campaign now?')) {
                            sendMutation.mutate(c.id);
                          }
                        }}
                      >
                        Send now
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => cancelMutation.mutate(c.id)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : null}
                  {c.status !== 'sending' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm('Delete this campaign?')) {
                          deleteMutation.mutate(c.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
