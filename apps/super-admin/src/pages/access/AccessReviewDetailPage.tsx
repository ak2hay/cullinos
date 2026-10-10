import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, ListChecks, ShieldCheck, ShieldOff } from 'lucide-react';
import { Badge, Button } from '@cullinos/ui';
import { DataTable, KpiCard, KpiGrid, PageHeader, StatusPill, useConfirm } from '@/components/ui';
import { inputClass, MutationError, Notice } from '@/components/common';
import { formatDateTime, personLabel, securityApi, type ReviewItem } from '@/lib/platform-api';
import { useAuthStore } from '@/stores/auth';

export function AccessReviewDetailPage() {
  const [confirm, confirmDialog] = useConfirm();
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.admin);
  const [onlyMine, setOnlyMine] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const key = ['super-admin', 'review-campaign', id];
  const query = useQuery({ queryKey: key, queryFn: () => securityApi.campaign(id), enabled: Boolean(id) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['super-admin', 'review-campaigns'] });
    qc.invalidateQueries({ queryKey: ['super-admin', 'my-reviews'] });
  };
  const decide = useMutation({
    mutationFn: ({ item, decision }: { item: ReviewItem; decision: 'certified' | 'revoked' }) =>
      securityApi.decide(item.id, decision, comments[item.id]?.trim() || undefined),
    onSuccess: refresh,
  });
  const close = useMutation({ mutationFn: () => securityApi.closeCampaign(id), onSuccess: refresh });

  const c = query.data;
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!c) return <Notice tone="error">{(query.error as Error)?.message ?? 'Campaign not found'}</Notice>;
  const open = c.status === 'open';
  const items = c.canManage && !onlyMine ? c.items : c.items.filter((i) => i.reviewerId === me?.id || (c.canManage && !i.reviewerId));

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        breadcrumbs={[
          { label: 'Governance' },
          { label: c.canManage ? 'Access reviews' : 'My reviews', to: c.canManage ? '/access/reviews' : '/access/my-reviews' },
          { label: c.name },
        ]}
        title={c.name}
        description={`Due ${formatDateTime(c.dueAt)}${c.closedAt ? ` · closed ${formatDateTime(c.closedAt)}` : ''}`}
        meta={<StatusPill status={c.status} />}
        actions={
          <>
            {c.canManage && open ? (
              <Button
                size="sm"
                variant="danger"
                loading={close.isPending}
                onClick={() =>
                  void confirm({ title: `Close now? ${c.progress.pending} unreviewed grant(s) will be revoked.` }).then((ok) => ok && close.mutate())
                }
              >
                Close campaign
              </Button>
            ) : null}
          </>
        }
      />
      {close.data ? <Notice tone="success">Closed. {close.data.autoRevoked} unreviewed grant(s) revoked.</Notice> : null}
      <MutationError error={close.error ?? decide.error} />
      <KpiGrid>
        <KpiCard label="Total" value={c.progress.total} icon={ListChecks} tone="indigo" />
        <KpiCard label="Pending" value={c.progress.pending} icon={Clock} tone="orange" />
        <KpiCard label="Certified" value={c.progress.certified} icon={ShieldCheck} tone="green" />
        <KpiCard label="Revoked" value={c.progress.revoked} icon={ShieldOff} tone="rose" />
      </KpiGrid>
      <DataTable
        rows={items}
        getRowKey={(i) => i.id}
        emptyMessage="Nothing for you to review here."
        toolbar={
          c.canManage ? (
            <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
              Only items I review (and unassigned)
            </label>
          ) : null
        }
        columns={[
          { key: 'who', header: 'Employee', cell: (i) => personLabel(i.user) },
          {
            key: 'access',
            header: 'Access',
            cell: (i) => (
              <div>
                <p className="font-medium">
                  {i.roleKey} {i.isPrimary ? <Badge variant="brand">primary</Badge> : null}
                </p>
                {i.assignment ? (
                  <p className="text-xs text-text-muted">
                    {i.assignment.scopeType === 'global' ? 'all tenants' : `${i.assignment.scopeType}: ${i.assignment.scopeValues.join(', ')}`}
                    {i.assignment.reason ? ` · ${i.assignment.reason}` : ''}
                  </p>
                ) : null}
              </div>
            ),
          },
          { key: 'reviewer', header: 'Reviewer', cell: (i) => (i.reviewer ? personLabel(i.reviewer) : 'Campaign owner') },
          {
            key: 'decision',
            header: 'Decision',
            cell: (i) =>
              i.decision !== 'pending' ? (
                <div>
                  <StatusPill status={i.decision} />
                  {i.comment ? <p className="mt-1 text-xs text-text-muted">{i.comment}</p> : null}
                </div>
              ) : open && i.userId !== me?.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className={`${inputClass} w-40 py-1 text-xs`}
                    placeholder="Comment"
                    value={comments[i.id] ?? ''}
                    onChange={(e) => setComments({ ...comments, [i.id]: e.target.value })}
                  />
                  <Button size="sm" variant="success" onClick={() => decide.mutate({ item: i, decision: 'certified' })}>
                    Keep
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => decide.mutate({ item: i, decision: 'revoked' })}>
                    Revoke
                  </Button>
                </div>
              ) : (
                <StatusPill status="pending" />
              ),
          },
        ]}
      />
    </div>
  );
}

export function MyReviewsPage() {
  const query = useQuery({ queryKey: ['super-admin', 'my-reviews'], queryFn: securityApi.myReviews });
  return (
    <div className="space-y-6">
      <PageHeader title="My access reviews" description="Confirm whether the people who report to you still need their access." />
      {query.data?.length === 0 ? <Notice tone="success">Nothing to review right now.</Notice> : null}
      <ul className="space-y-3">
        {(query.data ?? []).map((r) => (
          <li key={r.campaign.id}>
            <Link
              to={`/access/reviews/${r.campaign.id}`}
              className="flex items-center justify-between rounded-xl border border-line-subtle bg-bg-card p-4 hover:bg-hover"
            >
              <span className="font-medium">{r.campaign.name}</span>
              <span className="text-sm text-text-secondary">
                {r.pending} to review · due {formatDateTime(r.campaign.dueAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
