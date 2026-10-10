import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Archive, Inbox, Mail, MailOpen, RotateCcw } from 'lucide-react';
import { Button } from '@cullinos/ui';
import { Card, EmptyState, EntityAvatar, FilterTabs, PageHeader, StatusPill } from '@/components/ui';
import { MutationError } from '@/components/common';
import { relativeTime } from '@/lib/format';
import { marketingApi } from '@/lib/marketing-api';

type Filter = '' | 'new' | 'read' | 'archived';

export function InquiriesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('');
  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['marketing', 'inquiries', filter],
    queryFn: () => marketingApi.listInquiries(filter || undefined),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => marketingApi.updateInquiry(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing', 'inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'inquiries-count'] });
    },
  });

  const update = (id: unknown, status: string) => updateMutation.mutate({ id: String(id), status });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website inquiries"
        description="Leads from cullinos.com/contact. Email is still sent to sales; this is the inbox."
      />

      <FilterTabs
        label="Inquiry status"
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: '', label: 'All' },
          { id: 'new', label: 'New' },
          { id: 'read', label: 'Read' },
          { id: 'archived', label: 'Archived' },
        ]}
      />
      <MutationError error={updateMutation.error} />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-bg-secondary" />
          ))}
        </div>
      ) : inquiries.length === 0 ? (
        <Card>
          <EmptyState icon={Inbox} title={filter ? `No ${filter} inquiries` : 'No inquiries yet'} description="New leads from the contact form will appear here." />
        </Card>
      ) : (
        <ul className="space-y-3">
          {inquiries.map((row) => (
            <li key={String(row.id)}>
              <Card className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <EntityAvatar name={String(row.business || row.name)} size={40} />
                    <div className="min-w-0">
                      <p className="font-medium">
                        {String(row.name)} <span className="text-text-muted">·</span> {String(row.business)}
                      </p>
                      <p className="text-sm text-text-secondary">
                        <a href={`mailto:${String(row.email)}`} className="text-accent hover:underline">
                          {String(row.email)}
                        </a>
                        {row.phone ? ` · ${String(row.phone)}` : ''}
                        {row.city ? ` · ${String(row.city)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.createdAt ? (
                      <span className="text-xs text-text-muted" title={new Date(String(row.createdAt)).toLocaleString()}>
                        {relativeTime(String(row.createdAt))}
                      </span>
                    ) : null}
                    <StatusPill status={String(row.status)} />
                  </div>
                </div>
                {row.planInterest || row.outlets ? (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {row.planInterest ? <span className="rounded-md bg-bg-secondary px-2 py-0.5">Plan: {String(row.planInterest)}</span> : null}
                    {row.outlets ? <span className="rounded-md bg-bg-secondary px-2 py-0.5">Outlets: {String(row.outlets)}</span> : null}
                  </div>
                ) : null}
                <p className="whitespace-pre-wrap text-sm text-text-primary">{String(row.message)}</p>
                <div className="flex flex-wrap gap-2 border-t border-line-subtle pt-3">
                  <Button size="sm" variant="secondary" onClick={() => (window.location.href = `mailto:${String(row.email)}`)}>
                    <Mail size={14} aria-hidden="true" />
                    Reply
                  </Button>
                  {row.status !== 'read' ? (
                    <Button size="sm" variant="ghost" disabled={updateMutation.isPending} onClick={() => update(row.id, 'read')}>
                      <MailOpen size={14} aria-hidden="true" />
                      Mark read
                    </Button>
                  ) : null}
                  {row.status !== 'archived' ? (
                    <Button size="sm" variant="ghost" disabled={updateMutation.isPending} onClick={() => update(row.id, 'archived')}>
                      <Archive size={14} aria-hidden="true" />
                      Archive
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={updateMutation.isPending} onClick={() => update(row.id, 'new')}>
                      <RotateCcw size={14} aria-hidden="true" />
                      Restore
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
