import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { superAdminApi } from '@/lib/api';

export function PromoEmailPage() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ['promo', 'owners'],
    queryFn: superAdminApi.listOwnerRecipients,
  });

  const campaignsQuery = useQuery({
    queryKey: ['promo', 'campaigns'],
    queryFn: () => superAdminApi.listPromoCampaigns(1, 20),
  });

  const sendMutation = useMutation({
    mutationFn: superAdminApi.sendPromoCampaign,
    onSuccess: (result) => {
      setMessage(
        `Campaign ${result.status}: sent ${result.sentCount} of ${result.recipientCount}` +
          (result.failedCount ? ` (${result.failedCount} failed)` : ''),
      );
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['promo', 'campaigns'] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  function toggleId(id: string) {
    setSelectAll(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const ownerUserIds = selectAll ? undefined : [...selectedIds];
    if (!selectAll && (!ownerUserIds || ownerUserIds.length === 0)) {
      setError('Select at least one recipient');
      return;
    }
    const count = selectAll ? recipients.length : ownerUserIds!.length;
    if (!window.confirm(`Send this email to ${count} owner(s)?`)) {
      return;
    }
    sendMutation.mutate({ subject, body, ownerUserIds });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Promo email</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Compose a promotional email and send it to restaurant owners across tenants.
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border border-white/10 bg-bg-card px-4 py-3 text-sm text-text-secondary">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSend} className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">Compose</h2>
          <label className="block">
            <span className="mb-1.5 block text-sm text-text-secondary">Subject</span>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-text-secondary">Body</span>
            <textarea
              required
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
            />
          </label>
          <button
            type="submit"
            disabled={sendMutation.isPending || recipients.length === 0}
            className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {sendMutation.isPending ? 'Sending…' : 'Send campaign'}
          </button>
        </section>

        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium">Owners ({recipients.length})</h2>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={(e) => {
                  setSelectAll(e.target.checked);
                  if (e.target.checked) setSelectedIds(new Set());
                }}
              />
              Select all
            </label>
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-text-muted">Loading owners…</p>
          ) : recipients.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">No owner emails found.</p>
          ) : (
            <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto">
              {recipients.map((r) => (
                <li key={r.id}>
                  <label className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
                    <input
                      type="checkbox"
                      disabled={selectAll}
                      checked={selectAll || selectedIds.has(r.id)}
                      onChange={() => toggleId(r.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium">{r.name}</span>
                      <span className="block text-xs text-text-muted">{r.email}</span>
                      <span className="block text-xs text-text-muted">{r.organizationName}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </form>

      <section className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
        <div className="border-b border-white/5 px-4 py-3">
          <h2 className="font-medium">Recent campaigns</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Sent</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {campaignsQuery.isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : (campaignsQuery.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-text-muted">
                  No campaigns yet.
                </td>
              </tr>
            ) : (
              (campaignsQuery.data ?? []).map((c) => (
                <tr key={c.id} className="border-b border-white/5">
                  <td className="px-4 py-3">{c.subject}</td>
                  <td className="px-4 py-3">
                    {c.sentCount}/{c.recipientCount}
                    {c.failedCount ? ` (${c.failedCount} failed)` : ''}
                  </td>
                  <td className="px-4 py-3 capitalize">{c.status}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(c.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
