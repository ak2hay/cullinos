import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { superAdminApi } from '@/lib/api';

export function GuestPushPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['super-admin', 'guest-push'],
    queryFn: superAdminApi.listGuestPushCampaigns,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      superAdminApi.sendGuestPushCampaign({ title: title.trim(), body: body.trim() }),
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'guest-push'] });
      setTitle('');
      setBody('');
      setMessage(`Broadcast queued/sent — ${row.sentCount} device(s) reached.`);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required');
      return;
    }
    if (
      !window.confirm(
        'Broadcast this push to all Cullinos App users who allow marketing notifications?',
      )
    ) {
      return;
    }
    sendMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Push broadcast</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Send a platform-wide marketing notification. Guests who disabled marketing push are
          skipped automatically.
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
        <h2 className="text-lg font-medium">Compose broadcast</h2>
        <form className="mt-4 space-y-3" onSubmit={handleSend}>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            required
          />
          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Body</span>
            <textarea
              className="min-h-28 w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={240}
              required
            />
          </label>
          <Button type="submit" disabled={sendMutation.isPending}>
            {sendMutation.isPending ? 'Sending…' : 'Broadcast to all guests'}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="text-lg font-medium">Broadcast history</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No broadcasts yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {campaigns.map((c) => (
              <li key={c.id} className="py-3">
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-text-secondary">{c.body}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {c.status} · {c.sentCount} sent
                  {c.sentAt ? ` · ${new Date(c.sentAt).toLocaleString()}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
