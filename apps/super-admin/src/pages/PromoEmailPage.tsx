import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@cullinos/ui';
import { DataTable, PageHeader, SearchInput, SectionCard, StatusPill, useConfirm } from '@/components/ui';
import { inputClass, LabeledInput, Notice } from '@/components/common';
import { superAdminApi } from '@/lib/api';

export function PromoEmailPage() {
  const queryClient = useQueryClient();
  const [confirm, confirmDialog] = useConfirm();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const [search, setSearch] = useState('');
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const ownerUserIds = selectAll ? undefined : [...selectedIds];
    if (!selectAll && (!ownerUserIds || ownerUserIds.length === 0)) {
      setError('Select at least one recipient');
      return;
    }
    const count = selectAll ? recipients.length : ownerUserIds!.length;
    const ok = await confirm({
      title: `Send this email to ${count} owner${count === 1 ? '' : 's'}?`,
      description: 'Emails go out immediately and cannot be recalled.',
      confirmLabel: 'Send campaign',
      tone: 'primary',
    });
    if (!ok) return;
    sendMutation.mutate({ subject, body, ownerUserIds });
  }

  const q = search.trim().toLowerCase();
  const visible = recipients.filter(
    (r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (r.organizationName ?? '').toLowerCase().includes(q),
  );
  const selectedCount = selectAll ? recipients.length : selectedIds.size;

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader title="Promo email" description="Compose a promotional email and send it to restaurant owners across tenants." />

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <form onSubmit={(e) => void handleSend(e)} className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <SectionCard title="Compose">
          <div className="space-y-4">
            <LabeledInput label="Subject">
              <input required value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
            </LabeledInput>
            <LabeledInput label="Body">
              <textarea required rows={12} value={body} onChange={(e) => setBody(e.target.value)} className={inputClass} />
            </LabeledInput>
            <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
              <Button type="submit" loading={sendMutation.isPending} disabled={recipients.length === 0}>
                <Send size={16} aria-hidden="true" />
                Send campaign
              </Button>
              <span className="text-sm text-text-muted">
                {selectedCount} recipient{selectedCount === 1 ? '' : 's'} selected
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={`Owners (${recipients.length})`}
          actions={
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                className="accent-accent"
                checked={selectAll}
                onChange={(e) => {
                  setSelectAll(e.target.checked);
                  if (e.target.checked) setSelectedIds(new Set());
                }}
              />
              Select all
            </label>
          }
        >
          <SearchInput label="Search owners" placeholder="Search name, email, tenant…" value={search} onChange={setSearch} className="sm:w-full" />
          {isLoading ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-bg-secondary" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">{recipients.length === 0 ? 'No owner emails found.' : 'No owners match.'}</p>
          ) : (
            <ul className="sa-scroll mt-3 max-h-[26rem] space-y-1 overflow-y-auto">
              {visible.map((r) => (
                <li key={r.id}>
                  <label className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-hover">
                    <input
                      type="checkbox"
                      className="mt-1 accent-accent"
                      disabled={selectAll}
                      checked={selectAll || selectedIds.has(r.id)}
                      onChange={() => toggleId(r.id)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {r.email} · {r.organizationName}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </form>

      <SectionCard title="Recent campaigns" flush>
        <DataTable
          bare
          rows={campaignsQuery.data ?? []}
          loading={campaignsQuery.isLoading}
          getRowKey={(c) => c.id}
          emptyMessage="No campaigns yet"
          columns={[
            { key: 'subject', header: 'Subject', cell: (c) => <span className="font-medium">{c.subject}</span> },
            {
              key: 'sent',
              header: 'Delivered',
              cell: (c) => (
                <span className="tabular-nums">
                  {c.sentCount}/{c.recipientCount}
                  {c.failedCount ? <span className="ml-1 text-xs text-status-error">({c.failedCount} failed)</span> : null}
                </span>
              ),
            },
            { key: 'status', header: 'Status', cell: (c) => <StatusPill status={c.status} /> },
            { key: 'when', header: 'When', className: 'whitespace-nowrap text-text-secondary', cell: (c) => new Date(c.createdAt).toLocaleString() },
          ]}
        />
      </SectionCard>
    </div>
  );
}
