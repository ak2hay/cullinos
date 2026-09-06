import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { promoApi } from '@/lib/api';

export function PromoEmailPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ['promo', 'customers'],
    queryFn: promoApi.listCustomerRecipients,
  });

  const withEmail = useMemo(
    () => recipients.filter((r) => !!r.email),
    [recipients],
  );

  const sendMutation = useMutation({
    mutationFn: promoApi.sendCampaign,
    onSuccess: (result) => {
      setMessage(
        `Campaign ${result.status}: sent ${result.sentCount} of ${result.recipientCount}` +
          (result.failedCount ? ` (${result.failedCount} failed)` : ''),
      );
      setError(null);
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
    const customerIds = selectAll ? undefined : [...selectedIds];
    if (!selectAll && (!customerIds || customerIds.length === 0)) {
      setError('Select at least one recipient');
      return;
    }
    if (
      !window.confirm(
        `Send this email to ${selectAll ? withEmail.length : customerIds!.length} customer(s)?`,
      )
    ) {
      return;
    }
    sendMutation.mutate({ subject, body, customerIds });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Promo email</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Compose a promotional email and send it to customers who have an email on file.
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
          <Input
            label="Subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
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
          <Button type="submit" loading={sendMutation.isPending} disabled={withEmail.length === 0}>
            Send campaign
          </Button>
        </section>

        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium">Recipients ({withEmail.length})</h2>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={(e) => {
                  setSelectAll(e.target.checked);
                  if (e.target.checked) setSelectedIds(new Set());
                }}
              />
              Select all with email
            </label>
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-text-muted">Loading customers…</p>
          ) : withEmail.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">No customers with email addresses yet.</p>
          ) : (
            <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto">
              {withEmail.map((r) => (
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
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </form>
    </div>
  );
}
