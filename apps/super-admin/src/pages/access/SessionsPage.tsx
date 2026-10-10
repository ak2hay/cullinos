import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { DataTable, PageHeader, useConfirm } from '@/components/ui';
import { inputClass, MutationError } from '@/components/common';
import { formatDateTime, securityApi } from '@/lib/platform-api';

export function SessionsPage() {
  const [confirm, confirmDialog] = useConfirm();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const query = useQuery({ queryKey: ['super-admin', 'staff-sessions'], queryFn: () => securityApi.sessions(), refetchInterval: 60_000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ['super-admin', 'staff-sessions'] });
  const revoke = useMutation({ mutationFn: (id: string) => securityApi.revokeSession(id), onSuccess: refresh });
  const revokeAll = useMutation({ mutationFn: (userId: string) => securityApi.revokeAllForUser(userId), onSuccess: refresh });
  const needle = filter.trim().toLowerCase();
  const rows = (query.data ?? []).filter(
    (s) => !needle || `${s.user.name} ${s.user.email} ${s.user.employeeCode ?? ''}`.toLowerCase().includes(needle),
  );

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title="Staff sessions"
        description="Signed-in devices across the platform team. Revoking signs the device out on its next request."
      />
      <MutationError error={revoke.error ?? revokeAll.error} />
      <DataTable
        rows={rows}
        loading={query.isLoading}
        getRowKey={(s) => s.id}
        toolbar={<input className={`${inputClass} w-64`} placeholder="Filter by person…" value={filter} onChange={(e) => setFilter(e.target.value)} />}
        columns={[
          {
            key: 'who',
            header: 'Employee',
            cell: (s) => (
              <Link to={`/people/${s.user.id}`} className="hover:text-accent">
                <p className="font-medium">{s.user.name}</p>
                <p className="text-xs text-text-muted">
                  {s.user.employeeCode ?? '—'} · {s.user.email}
                </p>
              </Link>
            ),
          },
          { key: 'device', header: 'Device', cell: (s) => <span className="line-clamp-2 text-xs">{s.userAgent ?? 'Unknown'}</span> },
          { key: 'portal', header: 'Portal', cell: (s) => s.portal ?? '—' },
          { key: 'since', header: 'Signed in', cell: (s) => formatDateTime(s.createdAt) },
          { key: 'last', header: 'Last used', cell: (s) => formatDateTime(s.lastUsedAt) },
          {
            key: 'x',
            header: '',
            cell: (s) => (
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-status-error hover:underline" onClick={() => revoke.mutate(s.id)}>
                  Revoke
                </button>
                <button
                  type="button"
                  className="text-text-secondary hover:underline"
                  onClick={() => void confirm({ title: `Sign ${s.user.name} out everywhere?` }).then((ok) => ok && revokeAll.mutate(s.user.id))}
                >
                  All devices
                </button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
