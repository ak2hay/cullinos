import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { guestOpsApi, type GuestOpsOutletRow } from '@/lib/api';

export function GuestOpsMarketplacePage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [listed, setListed] = useState('');
  const [featured, setFeatured] = useState('');
  const [moderationStatus, setModerationStatus] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rankEdits, setRankEdits] = useState<Record<string, string>>({});

  const filters = {
    q: q.trim() || undefined,
    listed: listed || undefined,
    featured: featured || undefined,
    moderationStatus: moderationStatus || undefined,
    limit: '50',
  };

  const { data, isLoading } = useQuery({
    queryKey: ['guest-ops', 'outlets', filters],
    queryFn: () => guestOpsApi.listOutlets(filters),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof guestOpsApi.updateOutlet>[1] }) =>
      guestOpsApi.updateOutlet(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'outlets'] });
      setMessage('Outlet updated.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  function patch(id: string, body: Parameters<typeof guestOpsApi.updateOutlet>[1]) {
    patchMutation.mutate({ id, body });
  }

  function saveRank(o: GuestOpsOutletRow) {
    const raw = rankEdits[o.id];
    const rank = raw === '' || raw === undefined ? null : Number(raw);
    patch(o.id, { marketplaceFeaturedRank: rank });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Marketplace outlets</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Control listing, featuring, moderation, and platform unlist for marketplace discovery.
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, city, org…" />
          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Listed</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={listed}
              onChange={(e) => setListed(e.target.value)}
            >
              <option value="">Any</option>
              <option value="true">Listed</option>
              <option value="false">Not listed</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Featured</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={featured}
              onChange={(e) => setFeatured(e.target.value)}
            >
              <option value="">Any</option>
              <option value="true">Featured</option>
              <option value="false">Not featured</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Moderation</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={moderationStatus}
              onChange={(e) => setModerationStatus(e.target.value)}
            >
              <option value="">Any</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Outlets</h2>
          {data ? (
            <p className="text-sm text-text-muted">
              {data.items.length} of {data.total}
            </p>
          ) : null}
        </div>
        {isLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : !data?.items.length ? (
          <p className="mt-3 text-sm text-text-muted">No outlets match filters.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-text-secondary">
                  <th className="pb-2 pr-3 font-medium">Outlet</th>
                  <th className="pb-2 pr-3 font-medium">Listed</th>
                  <th className="pb-2 pr-3 font-medium">Featured</th>
                  <th className="pb-2 pr-3 font-medium">Rank</th>
                  <th className="pb-2 pr-3 font-medium">Moderation</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id} className="border-b border-white/5 align-top">
                    <td className="py-3 pr-3">
                      <p className="font-medium">{o.name}</p>
                      <p className="text-xs text-text-muted">
                        {o.organization.name}
                        {o.city ? ` · ${o.city}` : ''}
                      </p>
                      {o.marketplaceUnlistedByPlatform ? (
                        <span className="mt-1 inline-block text-xs text-status-warning">
                          Platform unlisted
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="checkbox"
                        checked={o.marketplaceListed}
                        disabled={o.marketplaceUnlistedByPlatform}
                        onChange={(e) =>
                          patch(o.id, { marketplaceListed: e.target.checked })
                        }
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="checkbox"
                        checked={o.marketplaceFeatured}
                        onChange={(e) =>
                          patch(o.id, { marketplaceFeatured: e.target.checked })
                        }
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className="w-16 rounded border border-white/10 bg-bg-primary px-2 py-1"
                          value={rankEdits[o.id] ?? String(o.marketplaceFeaturedRank ?? '')}
                          onChange={(e) =>
                            setRankEdits((m) => ({ ...m, [o.id]: e.target.value }))
                          }
                        />
                        <Button type="button" variant="ghost" onClick={() => saveRank(o)}>
                          Set
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 pr-3 capitalize">{o.marketplaceModerationStatus ?? '—'}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            patch(o.id, { marketplaceModerationStatus: 'approved' })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            patch(o.id, { marketplaceModerationStatus: 'rejected' })
                          }
                        >
                          Reject
                        </Button>
                        {!o.marketplaceUnlistedByPlatform ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm('Force unlist this outlet from marketplace?')) {
                                patch(o.id, { marketplaceUnlistedByPlatform: true });
                              }
                            }}
                          >
                            Force unlist
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              patch(o.id, { marketplaceUnlistedByPlatform: false })
                            }
                          >
                            Clear unlist
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
