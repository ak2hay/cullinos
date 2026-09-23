import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { guestOpsApi, type GuestOpsUserSearchRow } from '@/lib/api';

export function GuestOpsUsersPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['guest-ops', 'users', searchQ],
    queryFn: () => guestOpsApi.searchUsers({ q: searchQ || undefined, limit: '30' }),
    enabled: searchQ.length > 0,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['guest-ops', 'users', selectedId],
    queryFn: () => guestOpsApi.getUser(selectedId!),
    enabled: !!selectedId,
  });

  const eraseMutation = useMutation({
    mutationFn: (id: string) => guestOpsApi.eraseUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'users'] });
      setSelectedId(null);
      setMessage('Guest user erased (anonymized).');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  async function handleExport(id: string) {
    try {
      const data = await guestOpsApi.exportUser(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guest-user-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Export downloaded.');
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setMessage(null);
    }
  }

  function selectUser(u: GuestOpsUserSearchRow) {
    setSelectedId(u.id);
    setMessage(null);
    setError(null);
  }

  const memberships = (detail?.memberships as Array<Record<string, unknown>> | undefined) ?? [];
  const devices = (detail?.devices as Array<Record<string, unknown>> | undefined) ?? [];
  const prefs = detail?.notificationPreference as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Guest users</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Search guest accounts, inspect memberships and devices, export data, or erase (GDPR).
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
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSearchQ(q.trim());
            setSelectedId(null);
          }}
        >
          <div className="min-w-[240px] flex-1">
            <Input
              label="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, phone, email, or user ID"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/5 bg-bg-card p-5">
          <h2 className="text-lg font-medium">Results</h2>
          {!searchQ ? (
            <p className="mt-3 text-sm text-text-muted">Enter a query to search.</p>
          ) : isLoading ? (
            <p className="mt-3 text-sm text-text-muted">Searching…</p>
          ) : users.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No users found.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/5">
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className={`w-full py-3 text-left transition hover:bg-white/5 ${
                      selectedId === u.id ? 'bg-brand-primary/10' : ''
                    }`}
                    onClick={() => selectUser(u)}
                  >
                    <p className="font-medium">{u.name ?? 'Unnamed guest'}</p>
                    <p className="text-sm text-text-secondary">
                      {u.phone ?? '—'} · {u.email ?? '—'}
                    </p>
                    <p className="text-xs text-text-muted">
                      {u.counts.memberships} memberships · {u.counts.devices} devices ·{' '}
                      {u.counts.reviews} reviews
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-white/5 bg-bg-card p-5">
          <h2 className="text-lg font-medium">Detail</h2>
          {!selectedId ? (
            <p className="mt-3 text-sm text-text-muted">Select a user from results.</p>
          ) : detailLoading ? (
            <p className="mt-3 text-sm text-text-muted">Loading…</p>
          ) : detail ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="font-medium">{String(detail.name ?? 'Unnamed')}</p>
                <p className="text-text-secondary">
                  {String(detail.phone ?? '—')} · {String(detail.email ?? '—')}
                </p>
                <p className="text-xs text-text-muted">ID: {selectedId}</p>
              </div>

              <div>
                <p className="font-medium">Memberships ({memberships.length})</p>
                {memberships.length === 0 ? (
                  <p className="text-text-muted">None</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {memberships.map((m, i) => {
                      const org = m.organization as { name?: string } | undefined;
                      return (
                        <li key={i} className="text-text-secondary">
                          {org?.name ?? String(m.organizationId ?? '—')}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <p className="font-medium">Devices ({devices.length})</p>
                {devices.length === 0 ? (
                  <p className="text-text-muted">None</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {devices.slice(0, 5).map((d, i) => (
                      <li key={i} className="text-text-secondary">
                        {String(d.platform ?? 'device')} · last seen{' '}
                        {d.lastSeenAt
                          ? new Date(String(d.lastSeenAt)).toLocaleString()
                          : '—'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="font-medium">Notification preferences</p>
                {prefs ? (
                  <p className="text-text-secondary">
                    Marketing: {prefs.marketingEnabled ? 'on' : 'off'} · Orders:{' '}
                    {prefs.orderUpdatesEnabled ? 'on' : 'off'}
                  </p>
                ) : (
                  <p className="text-text-muted">Not set</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => handleExport(selectedId)}>
                  Export JSON
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Permanently erase this guest user? This anonymizes PII and cannot be undone.',
                      )
                    ) {
                      eraseMutation.mutate(selectedId);
                    }
                  }}
                >
                  Erase user
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
