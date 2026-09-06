import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { marketingApi } from '@/lib/marketing-api';

type Testimonial = {
  id: string;
  quote: string;
  author: string;
  role: string;
  sortOrder?: number;
  status?: string;
};

export function TestimonialsEditorPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ quote: '', author: '', role: '', sortOrder: '0' });
  const [error, setError] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['marketing', 'testimonials', status],
    queryFn: () => marketingApi.listTestimonials(status) as Promise<Testimonial[]>,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['marketing', 'testimonials'] });

  const createMutation = useMutation({
    mutationFn: () =>
      marketingApi.createTestimonial({
        quote: draft.quote,
        author: draft.author,
        role: draft.role,
        sortOrder: Number(draft.sortOrder) || 0,
      }),
    onSuccess: () => {
      setCreating(false);
      setDraft({ quote: '', author: '', role: '', sortOrder: '0' });
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      marketingApi.updateTestimonial(editing!.id, {
        quote: draft.quote,
        author: draft.author,
        role: draft.role,
        sortOrder: Number(draft.sortOrder) || 0,
      }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => marketingApi.deleteTestimonial(id),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  });

  function startEdit(item: Testimonial) {
    setEditing(item);
    setCreating(false);
    setDraft({
      quote: item.quote,
      author: item.author,
      role: item.role,
      sortOrder: String(item.sortOrder ?? 0),
    });
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Testimonials</h1>
          <p className="mt-1 text-text-secondary">Customer quotes for the marketing site.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
            className="rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditing(null);
              setDraft({ quote: '', author: '', role: '', sortOrder: '0' });
            }}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-bg-primary"
          >
            Add testimonial
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/5 bg-bg-card p-5">
              <p className="text-sm italic text-text-secondary">&ldquo;{item.quote}&rdquo;</p>
              <p className="mt-2 text-sm font-medium">
                {item.author}
                <span className="text-text-muted"> · {item.role}</span>
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="text-xs text-brand-primary hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Delete this testimonial?')) deleteMutation.mutate(item.id);
                  }}
                  className="text-xs text-status-error hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 ? (
            <p className="text-sm text-text-muted">No testimonials in {status}.</p>
          ) : null}
        </div>
      )}

      {creating || editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-bg-secondary p-6">
            <h2 className="text-lg font-medium">
              {editing ? 'Edit testimonial' : 'New testimonial'}
            </h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-text-muted">Quote</span>
                <textarea
                  value={draft.quote}
                  onChange={(e) => setDraft({ ...draft, quote: e.target.value })}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Author</span>
                <input
                  value={draft.author}
                  onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Role</span>
                <input
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Sort order</span>
                <input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
                className="rounded-lg px-4 py-2 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !draft.quote.trim() ||
                  !draft.author.trim() ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
                onClick={() => (editing ? updateMutation.mutate() : createMutation.mutate())}
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-bg-primary disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
