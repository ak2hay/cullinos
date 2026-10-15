import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Dialog } from '@cullinos/ui';
import { DataTable, PageHeader, StatusPill } from '@/components/ui';
import { inputClass, MutationError, Notice } from '@/components/common';
import { SavedViews } from '@/components/SavedViews';
import { useCan } from '@/lib/permissions';
import { formatDateTime, iamApi, peopleApi, type BulkInviteRow } from '@/lib/platform-api';

const FILTER_KEYS = ['q', 'departmentId', 'teamId', 'status', 'role'] as const;
const CSV_COLUMNS = ['email', 'name', 'platformRole', 'title', 'departmentCode', 'teamCode', 'managerEmail', 'region', 'location'] as const;

function parseCsv(text: string): BulkInviteRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const hasHeader = header.includes('email');
  const cols = hasHeader ? header : [...CSV_COLUMNS];
  return (hasHeader ? lines.slice(1) : lines).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row: Record<string, string> = {};
    cols.forEach((c, i) => {
      if (cells[i]) row[c] = cells[i];
    });
    return row as BulkInviteRow;
  });
}

function BulkInviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const rows = parseCsv(text);
  const run = useMutation({
    mutationFn: () => peopleApi.bulkInvite(rows),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'directory'] }),
  });
  return (
    <Dialog
      open={open}
      onClose={() => {
        run.reset();
        setText('');
        onClose();
      }}
      title="Bulk invite staff"
      size="lg"
      footer={
        run.data ? null : (
          <Button size="sm" loading={run.isPending} disabled={!rows.length || rows.length > 500} onClick={() => run.mutate()}>
            Invite {rows.length || ''}
          </Button>
        )
      }
    >
      {run.data ? (
        <div className="space-y-3">
          <Notice tone={run.data.failed ? 'warning' : 'success'}>
            {run.data.created} invited, {run.data.failed} failed.
          </Notice>
          <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
            {run.data.results.map((r) => (
              <li key={r.row} className={r.ok ? '' : 'text-status-error'}>
                Row {r.row} · {r.email} ·{' '}
                {r.ok
                  ? `${r.employeeCode}${r.emailSent ? ' · invite emailed' : ` · temp password ${r.temporaryPassword}`}`
                  : r.error}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Paste CSV with a header row. Columns: <span className="font-mono text-xs">{CSV_COLUMNS.join(', ')}</span>. Roles default to
            viewer; owners cannot be bulk-invited. Department and team use their codes.
          </p>
          <textarea
            className={`${inputClass} min-h-48 font-mono text-xs`}
            placeholder={`${CSV_COLUMNS.join(',')}\nasha@rkyves.com,Asha Rao,support,Support engineer,SUP,L1,lead@rkyves.com,Karnataka,Bengaluru`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-text-muted">{rows.length} row(s) detected · max 500 per batch</p>
          <MutationError error={run.error} />
        </div>
      )}
    </Dialog>
  );
}

export function DirectoryPage() {
  const navigate = useNavigate();
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<string, string>;
  const [search, setSearch] = useState(filters.q);
  const [bulkOpen, setBulkOpen] = useState(false);
  const departments = useQuery({ queryKey: ['super-admin', 'iam', 'departments'], queryFn: iamApi.departments });
  const teams = useQuery({ queryKey: ['super-admin', 'iam', 'teams'], queryFn: iamApi.teams });

  const query = useInfiniteQuery({
    queryKey: ['super-admin', 'directory', filters],
    queryFn: ({ pageParam }) =>
      peopleApi.directory({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), cursor: pageParam ?? undefined, limit: 50 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];
  const total = query.data?.pages[0]?.total;

  function apply(next: Record<string, string>) {
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
  }
  const set = (k: string, v: string) => apply({ ...filters, [k]: v });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee directory"
        description={`Everyone at Rkyves with platform access${total !== undefined ? ` · ${total} people` : ''}. Each person has a permanent employee ID used across the activity log, approvals and tenant sessions.`}
        actions={
          can('team.manage') ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)}>
                Bulk invite
              </Button>
              <Button size="sm" onClick={() => navigate('/employees?onboard=1')}>
                Onboard one
              </Button>
            </>
          ) : null
        }
      />
      <SavedViews page="directory" filters={filters} onApply={apply} />
      <DataTable
        rows={rows}
        loading={query.isLoading}
        getRowKey={(e) => e.userId}
        onRowClick={(e) => navigate(`/people/${e.userId}`)}
        hasMore={query.hasNextPage}
        onLoadMore={() => query.fetchNextPage()}
        loadingMore={query.isFetchingNextPage}
        columnChooser
        toolbar={
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                set('q', search);
              }}
            >
              <input className={`${inputClass} w-64`} placeholder="Name, email, title or RKY-…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </form>
            <select className={`${inputClass} w-auto`} value={filters.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
              <option value="">All departments</option>
              {(departments.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select className={`${inputClass} w-auto`} value={filters.teamId} onChange={(e) => set('teamId', e.target.value)}>
              <option value="">All teams</option>
              {(teams.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select className={`${inputClass} w-auto`} value={filters.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">Any status</option>
              {['active', 'on_leave', 'notice', 'exited'].map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </>
        }
        columns={[
          { key: 'code', header: 'Employee ID', cell: (e) => <span className="font-mono text-xs">{e.employeeCode}</span> },
          {
            key: 'name',
            header: 'Name',
            cell: (e) => (
              <div>
                <p className="font-medium">{e.name}</p>
                <p className="text-xs text-text-muted">{e.email}</p>
              </div>
            ),
          },
          { key: 'title', header: 'Title', cell: (e) => e.title ?? '—' },
          { key: 'team', header: 'Team', cell: (e) => [e.department?.name, e.team?.name].filter(Boolean).join(' / ') || '—' },
          { key: 'manager', header: 'Manager', cell: (e) => e.manager?.name ?? '—' },
          { key: 'role', header: 'Primary role', cell: (e) => e.primaryRole ?? '—' },
          { key: 'status', header: 'Status', cell: (e) => <StatusPill status={e.employmentStatus} /> },
          { key: 'region', header: 'Region', defaultHidden: true, cell: (e) => e.region ?? '—' },
          { key: 'login', header: 'Last login', defaultHidden: true, cell: (e) => formatDateTime(e.lastLoginAt) },
        ]}
      />
      <BulkInviteDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </div>
  );
}
