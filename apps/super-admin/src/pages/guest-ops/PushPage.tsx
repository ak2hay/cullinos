import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { guestOpsApi, type GuestOpsPushCampaignRow } from '@/lib/api';

type FormState = {
  title: string;
  body: string;
  audience: 'all' | 'marketing_opt_in' | 'city' | 'org';
  filterCity: string;
  filterOrgId: string;
  deepLink: string;
  scheduledAt: string;
};

const EMPTY: FormState = {
  title: '',
  body: '',
  audience: 'all',
  filterCity: '',
  filterOrgId: '',
  deepLink: '',
  scheduledAt: '',
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

function payloadFromForm(form: FormState) {
  return {
    title: form.title.trim(),
    body: form.body.trim(),
    audience: form.audience,
    audienceFilter: audienceFilterFromForm(form),
    deepLink: form.deepLink.trim() || null,
    scheduledAt: form.scheduledAt || null,
  };
}

export function GuestOpsPushPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['guest-ops', 'push-campaigns', statusFilter],
    queryFn: () =>
      guestOpsApi.listPushCampaigns({ status: statusFilter || undefined, limit: '50' }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = payloadFromForm(form);
      if (!payload.title || !payload.body) throw new Error('Title and body are required');
      if (editingId) return guestOpsApi.updatePushCampaign(editingId, payload);
      return guestOpsApi.createPushDraft(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'push-campaigns'] });
      setForm(EMPTY);
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
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => guestOpsApi.sendPushCampaign(id),
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'push-campaigns'] });
      setMessage(`Sent — ${row.sentCount} device(s) reached.`);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => guestOpsApi.cancelPush(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'push-campaigns'] });
      setMessage('Campaign cancelled.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => guestOpsApi.deletePushCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'push-campaigns'] });
      if (editingId) {
        setEditingId(null);
        setForm(EMPTY);
      }
      setMessage('Campaign deleted.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  function startEdit(c: GuestOpsPushCampaignRow) {
    const filter = (c.audienceFilter ?? {}) as Record<string, unknown>;
    setEditingId(c.id);
    setForm({
      title: c.title,
      body: c.body,
      audience: (['all', 'marketing_opt_in', 'city', 'org'].includes(c.audience)
        ? c.audience
        : 'all') as FormState['audience'],
      filterCity: typeof filter.city === 'string' ? filter.city : '',
      filterOrgId:
        typeof filter.organizationId === 'string'
          ? filter.organizationId
          : c.organizationId ?? '',
      deepLink: c.deepLink ?? '',
      scheduledAt: c.scheduledAt
        ? new Date(c.scheduledAt).toISOString().slice(0, 16)
        : '',
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Push campaigns</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Draft, schedule, and send marketing push notifications to guest app users.
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
        <h2 className="text-lg font-medium">{editingId ? 'Edit campaign' : 'New campaign'}</h2>
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
            maxLength={80}
            required
          />
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-text-secondary">Body</span>
            <textarea
              className="min-h-24 w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              maxLength={240}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Audience</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={form.audience}
              onChange={(e) =>
                setForm((f) => ({ ...f, audience: e.target.value as FormState['audience'] }))
              }
            >
              <option value="all">All guests</option>
              <option value="marketing_opt_in">Marketing opt-in</option>
              <option value="city">City</option>
              <option value="org">Organization members</option>
            </select>
          </label>
          {form.audience === 'city' ? (
            <Input
              label="City"
              value={form.filterCity}
              onChange={(e) => setForm((f) => ({ ...f, filterCity: e.target.value }))}
            />
          ) : form.audience === 'org' ? (
            <Input
              label="Organization ID"
              value={form.filterOrgId}
              onChange={(e) => setForm((f) => ({ ...f, filterOrgId: e.target.value }))}
            />
          ) : (
            <div />
          )}
          <Input
            label="Deep link (optional)"
            value={form.deepLink}
            onChange={(e) => setForm((f) => ({ ...f, deepLink: e.target.value }))}
          />
          <Input
            label="Schedule at (optional)"
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
          />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {editingId ? 'Save draft' : 'Create draft'}
            </Button>
            {editingId ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    scheduleMutation.mutate({
                      id: editingId,
                      scheduledAt: form.scheduledAt || undefined,
                    });
                  }}
                >
                  Schedule
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Send this campaign now?')) sendMutation.mutate(editingId);
                  }}
                >
                  Send now
                </Button>
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
              </>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Campaigns</h2>
          <select
            className="rounded-lg border border-white/10 bg-bg-primary px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-sm text-text-secondary">{c.body}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {c.status} · {c.audience} · {c.sentCount} sent
                    {c.scheduledAt
                      ? ` · scheduled ${new Date(c.scheduledAt).toLocaleString()}`
                      : ''}
                    {c.sentAt ? ` · sent ${new Date(c.sentAt).toLocaleString()}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex flex-wrap justify-end gap-2">
                    {c.status !== 'sent' && c.status !== 'sending' ? (
                      <>
                        <Button type="button" variant="ghost" onClick={() => startEdit(c)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            scheduleMutation.mutate({
                              id: c.id,
                              scheduledAt: c.scheduledAt ?? undefined,
                            })
                          }
                        >
                          Schedule
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Send this campaign now?')) sendMutation.mutate(c.id);
                          }}
                        >
                          Send
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => cancelMutation.mutate(c.id)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : c.status === 'sent' || c.status === 'sending' ? (
                      <p className="text-xs text-text-muted">Sent — cannot edit.</p>
                    ) : null}
                    {c.status !== 'sending' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Delete this campaign from history? Already-delivered notifications are not retracted.',
                            )
                          ) {
                            deleteMutation.mutate(c.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
