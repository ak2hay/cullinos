import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { marketingApi } from '@/lib/marketing-api';

export function InquiriesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('');
  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['marketing', 'inquiries', filter],
    queryFn: () => marketingApi.listInquiries(filter || undefined),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      marketingApi.updateInquiry(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing', 'inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'inquiries-count'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Website inquiries</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Leads from cullinos.com/contact. Email is still sent to sales; this is the inbox.
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-text-muted">Loading…</p>
      ) : inquiries.length === 0 ? (
        <p className="text-text-muted">No inquiries yet.</p>
      ) : (
        <ul className="space-y-3">
          {inquiries.map((row) => (
            <li
              key={String(row.id)}
              className="rounded-xl border border-line bg-bg-card p-5 space-y-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {String(row.name)} · {String(row.business)}
                  </p>
                  <p className="text-sm text-text-secondary">
                    <a href={`mailto:${String(row.email)}`} className="text-brand-primary hover:underline">
                      {String(row.email)}
                    </a>
                    {row.phone ? ` · ${String(row.phone)}` : ''}
                    {row.city ? ` · ${String(row.city)}` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-hover px-2 py-0.5 text-xs uppercase tracking-wide text-text-muted">
                  {String(row.status)}
                </span>
              </div>
              <p className="text-xs text-text-muted">
                {row.planInterest ? `Plan: ${String(row.planInterest)} · ` : ''}
                {row.outlets ? `Outlets: ${String(row.outlets)} · ` : ''}
                {row.createdAt ? new Date(String(row.createdAt)).toLocaleString() : ''}
              </p>
              <p className="whitespace-pre-wrap text-sm text-text-primary">{String(row.message)}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {row.status !== 'read' ? (
                  <button
                    type="button"
                    className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-hover"
                    onClick={() =>
                      updateMutation.mutate({ id: String(row.id), status: 'read' })
                    }
                  >
                    Mark read
                  </button>
                ) : null}
                {row.status !== 'archived' ? (
                  <button
                    type="button"
                    className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-hover"
                    onClick={() =>
                      updateMutation.mutate({ id: String(row.id), status: 'archived' })
                    }
                  >
                    Archive
                  </button>
                ) : null}
                {row.status === 'archived' ? (
                  <button
                    type="button"
                    className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-hover"
                    onClick={() =>
                      updateMutation.mutate({ id: String(row.id), status: 'new' })
                    }
                  >
                    Restore
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
