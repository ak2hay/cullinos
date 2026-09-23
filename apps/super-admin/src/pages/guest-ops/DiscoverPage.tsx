import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { guestOpsApi, type GuestOpsDiscoverSection } from '@/lib/api';

type FormState = {
  title: string;
  subtitle: string;
  type: 'outlets' | 'cuisine' | 'manual_outlets' | 'offers';
  payloadJson: string;
  sortOrder: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  title: '',
  subtitle: '',
  type: 'outlets',
  payloadJson: '{}',
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

function fromForm(form: FormState) {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(form.payloadJson || '{}') as Record<string, unknown>;
  } catch {
    throw new Error('Payload must be valid JSON');
  }
  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    type: form.type,
    payload,
    sortOrder: Number(form.sortOrder) || 0,
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
    isActive: form.isActive,
  };
}

export function GuestOpsDiscoverPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['guest-ops', 'discover-sections'],
    queryFn: guestOpsApi.listDiscoverSections,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = fromForm(form);
      if (!payload.title) throw new Error('Title is required');
      if (editingId) return guestOpsApi.updateDiscoverSection(editingId, payload);
      return guestOpsApi.createDiscoverSection(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'discover-sections'] });
      setForm(EMPTY);
      setEditingId(null);
      setMessage(editingId ? 'Section updated.' : 'Section created.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => guestOpsApi.deleteDiscoverSection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'discover-sections'] });
      setMessage('Section deleted.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  function startEdit(s: GuestOpsDiscoverSection) {
    setEditingId(s.id);
    setForm({
      title: s.title,
      subtitle: s.subtitle ?? '',
      type: (['outlets', 'cuisine', 'manual_outlets', 'offers'].includes(s.type)
        ? s.type
        : 'outlets') as FormState['type'],
      payloadJson: JSON.stringify(s.payload ?? {}, null, 2),
      sortOrder: String(s.sortOrder ?? 0),
      startsAt: toDatetimeLocal(s.startsAt),
      endsAt: toDatetimeLocal(s.endsAt),
      isActive: s.isActive,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Discover sections</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Curate home-screen rows in the Cullinos App discover feed.
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
        <h2 className="text-lg font-medium">{editingId ? 'Edit section' : 'New section'}</h2>
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
          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Type</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as FormState['type'] }))
              }
            >
              <option value="outlets">outlets</option>
              <option value="cuisine">cuisine</option>
              <option value="manual_outlets">manual_outlets</option>
              <option value="offers">offers</option>
            </select>
          </label>
          <Input
            label="Sort order"
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          />
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
          <label className="flex items-center gap-2 text-sm text-text-secondary sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-text-secondary">Payload (JSON)</span>
            <textarea
              className="min-h-32 w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2 font-mono text-xs"
              value={form.payloadJson}
              onChange={(e) => setForm((f) => ({ ...f, payloadJson: e.target.value }))}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {editingId ? 'Save changes' : 'Create section'}
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
        <h2 className="text-lg font-medium">All sections</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : sections.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No discover sections yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {sections.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    {s.title}
                    {!s.isActive ? (
                      <span className="ml-2 text-xs text-status-warning">Inactive</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {s.type} · sort {s.sortOrder}
                    {s.subtitle ? ` · ${s.subtitle}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => startEdit(s)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm('Delete this section?')) deleteMutation.mutate(s.id);
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
