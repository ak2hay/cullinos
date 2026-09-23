import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input, PageHeader, useToast } from '@cullinos/ui';
import { guestMarketingApi } from '@/lib/api';

export function GuestPushPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['guest-marketing', 'push'],
    queryFn: guestMarketingApi.listCampaigns,
  });

  const sendMutation = useMutation({
    mutationFn: () => guestMarketingApi.sendCampaign({ title: title.trim(), body: body.trim() }),
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ['guest-marketing', 'push'] });
      setTitle('');
      setBody('');
      toast.success(`Campaign sent to ${row.sentCount} device(s).`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error('Title and body are required');
      return;
    }
    if (
      !window.confirm(
        'Send this push to Cullinos App users with a membership at your organization?',
      )
    ) {
      return;
    }
    sendMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Push"
        description="Compose a marketing notification for Cullinos App users who have joined your restaurants. Respects each guest’s marketing preference."
      />

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="text-lg font-medium">Compose</h2>
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
            {sendMutation.isPending ? 'Sending…' : 'Send to org members'}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="text-lg font-medium">Campaign history</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No campaigns yet.</p>
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
