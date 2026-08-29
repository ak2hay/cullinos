import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { superAdminApi } from '@/lib/api';

export function TenantsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [suspendId, setSuspendId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['super-admin', 'organizations', page],
    queryFn: () => superAdminApi.listOrganizations(page),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason: r }: { id: string; reason: string }) =>
      superAdminApi.suspendOrganization(id, r),
    onSuccess: () => {
      setSuspendId(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.activateOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <p className="mt-1 text-text-secondary">
          Organizations on the platform — {data?.meta.total ?? 0} total.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load tenants'}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Outlets</th>
              <th className="px-4 py-3 font-medium">Users</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  Loading tenants…
                </td>
              </tr>
            ) : (
              (data?.data ?? []).map((tenant) => (
                <tr key={tenant.id} className="border-b border-white/5">
                  <td className="px-4 py-3">
                    <p className="font-medium">{tenant.name}</p>
                    <p className="text-xs text-text-muted">{tenant.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{tenant.plan ?? '—'}</p>
                    <p className="text-xs capitalize text-text-muted">
                      {tenant.subscriptionStatus?.toLowerCase() ?? 'no subscription'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        tenant.isActive
                          ? 'bg-status-success/15 text-status-success'
                          : 'bg-status-error/15 text-status-error'
                      }`}
                    >
                      {tenant.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{tenant.outletCount}</td>
                  <td className="px-4 py-3">{tenant.userCount}</td>
                  <td className="px-4 py-3">
                    {tenant.isActive ? (
                      <button
                        type="button"
                        onClick={() => setSuspendId(tenant.id)}
                        className="text-xs text-status-warning hover:underline"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => activateMutation.mutate(tenant.id)}
                        disabled={activateMutation.isPending}
                        className="text-xs text-status-success hover:underline"
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data?.meta.hasMore ? (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
        >
          Load more
        </button>
      ) : null}

      {suspendId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-bg-secondary p-6">
            <h2 className="text-lg font-medium">Suspend organization</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Provide a reason for suspension. Users will lose access immediately.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-4 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-brand-accent"
              placeholder="Reason for suspension"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSuspendId(null)}
                className="rounded-lg px-4 py-2 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reason.trim() || suspendMutation.isPending}
                onClick={() => suspendMutation.mutate({ id: suspendId, reason })}
                className="rounded-lg bg-status-error px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
