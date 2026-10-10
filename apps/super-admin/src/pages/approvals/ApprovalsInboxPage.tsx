import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DataTable, FilterSelect, FilterTabs, PageHeader, StatusPill } from '@/components/ui';
import { useCan } from '@/lib/permissions';
import { approvalsApi, formatDateTime, personLabel } from '@/lib/platform-api';
import { useAuthStore } from '@/stores/auth';

type Box = 'pending_for_me' | 'mine' | 'all';

export function ApprovalsInboxPage() {
  const navigate = useNavigate();
  const can = useCan();
  const isOwner = useAuthStore((s) => s.admin?.isOwner);
  const [params, setParams] = useSearchParams();
  const box = (params.get('box') as Box) || 'pending_for_me';
  const status = params.get('status') ?? '';
  const canSeeAll = isOwner || can('approvals.read_all');

  const query = useInfiniteQuery({
    queryKey: ['super-admin', 'approvals', box, status],
    queryFn: ({ pageParam }) => approvalsApi.list({ box, status: status || undefined, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: 30_000,
  });
  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];

  const tabs = [
    { id: 'pending_for_me' as Box, label: 'Waiting for me' },
    { id: 'mine' as Box, label: 'My requests' },
    ...(canSeeAll ? [{ id: 'all' as Box, label: 'All requests' }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Sensitive actions wait here until enough approvers agree. Requesters run approved actions from the request page; ticket access and exports apply automatically."
      />
      <DataTable
        header={<FilterTabs label="Approval boxes" tabs={tabs} value={box} onChange={(b) => setParams({ box: b })} />}
        toolbar={
          box !== 'pending_for_me' ? (
            <FilterSelect
              aria-label="Status"
              value={status}
              onChange={(e) => setParams({ box, ...(e.target.value ? { status: e.target.value } : {}) })}
              options={[
                { value: '', label: 'Any status' },
                ...['pending', 'approved', 'executed', 'rejected', 'expired', 'cancelled'].map((s) => ({
                  value: s,
                  label: s.charAt(0).toUpperCase() + s.slice(1),
                })),
              ]}
            />
          ) : undefined
        }
        emptyDescription={box === 'pending_for_me' ? 'New requests that need your vote will appear here.' : undefined}
        rows={rows}
        loading={query.isLoading}
        getRowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/approvals/${r.id}`)}
        hasMore={query.hasNextPage}
        onLoadMore={() => query.fetchNextPage()}
        loadingMore={query.isFetchingNextPage}
        emptyMessage={box === 'pending_for_me' ? 'Nothing is waiting for you.' : 'No requests.'}
        columns={[
          { key: 'ref', header: 'Ref', cell: (r) => <span className="font-mono text-xs">{r.ref}</span> },
          {
            key: 'title',
            header: 'Request',
            cell: (r) => (
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="line-clamp-1 text-xs text-text-muted">{r.justification}</p>
              </div>
            ),
          },
          { key: 'by', header: 'Requested by', cell: (r) => personLabel(r.requestedBy) },
          {
            key: 'votes',
            header: 'Approvals',
            cell: (r) => `${r.decisions.filter((d) => d.decision === 'approved').length} / ${r.requiredApprovals}`,
          },
          { key: 'status', header: 'Status', cell: (r) => <StatusPill status={r.status} /> },
          { key: 'created', header: 'Raised', cell: (r) => formatDateTime(r.createdAt) },
          { key: 'expires', header: 'Expires', defaultHidden: true, cell: (r) => formatDateTime(r.expiresAt) },
        ]}
        columnChooser
      />
    </div>
  );
}
