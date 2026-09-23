import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { guestOpsApi } from '@/lib/api';

export function GuestOpsReviewsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters = {
    status: status || undefined,
    q: q.trim() || undefined,
    limit: '50',
  };

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['guest-ops', 'reviews', filters],
    queryFn: () => guestOpsApi.listReviews(filters),
  });

  const moderateMutation = useMutation({
    mutationFn: ({
      id,
      status: nextStatus,
    }: {
      id: string;
      status: 'hidden' | 'removed' | 'visible';
    }) => guestOpsApi.moderateReview(id, { status: nextStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'reviews'] });
      setMessage('Review updated.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reviews moderation</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Hide, remove, or restore guest outlet reviews across the marketplace.
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Comment, outlet, guest…"
          />
          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Status</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
              <option value="removed">Removed</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="text-lg font-medium">Reviews</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : reviews.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No reviews match filters.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    {'★'.repeat(r.rating)}
                    <span className="ml-2 text-sm font-normal capitalize text-text-muted">
                      {r.status}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {r.outlet.name}
                    {r.outlet.city ? ` · ${r.outlet.city}` : ''}
                  </p>
                  {r.comment ? (
                    <p className="mt-1 text-sm">{r.comment}</p>
                  ) : (
                    <p className="mt-1 text-sm italic text-text-muted">No comment</p>
                  )}
                  <p className="mt-1 text-xs text-text-muted">
                    {r.guestUser?.name ?? 'Guest'}
                    {r.guestUser?.phone ? ` · ${r.guestUser.phone}` : ''}
                    {' · '}
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status !== 'hidden' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        moderateMutation.mutate({ id: r.id, status: 'hidden' })
                      }
                    >
                      Hide
                    </Button>
                  ) : null}
                  {r.status !== 'removed' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        moderateMutation.mutate({ id: r.id, status: 'removed' })
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                  {r.status !== 'visible' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        moderateMutation.mutate({ id: r.id, status: 'visible' })
                      }
                    >
                      Restore
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
