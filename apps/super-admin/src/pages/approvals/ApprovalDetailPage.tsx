import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@cullinos/ui';
import { PageHeader, SectionCard, StatusPill } from '@/components/ui';
import { inputClass, MutationError, Notice } from '@/components/common';
import { executeApprovedRequest } from '@/lib/api';
import { approvalsApi, formatDateTime, personLabel } from '@/lib/platform-api';
import { useAuthStore } from '@/stores/auth';

export function ApprovalDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.admin);
  const [comment, setComment] = useState('');
  const query = useQuery({ queryKey: ['super-admin', 'approval', id], queryFn: () => approvalsApi.get(id), enabled: Boolean(id) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['super-admin', 'approval', id] });
    qc.invalidateQueries({ queryKey: ['super-admin', 'approvals'] });
  };

  const decide = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') => approvalsApi.decide(id, decision, comment.trim() || undefined),
    onSuccess: () => {
      setComment('');
      refresh();
    },
  });
  const cancel = useMutation({ mutationFn: () => approvalsApi.cancel(id), onSuccess: refresh });
  const execute = useMutation({ mutationFn: () => executeApprovedRequest(id), onSuccess: refresh });

  const r = query.data;
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!r) return <Notice tone="error">{(query.error as Error)?.message ?? 'Not found'}</Notice>;

  const approvals = r.decisions.filter((d) => d.decision === 'approved').length;
  const mine = r.requestedBy.id === me?.id;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Approvals', to: '/approvals' }, { label: r.ref }]}
        title={r.title}
        description={`${r.ref} · Requested by ${personLabel(r.requestedBy)} on ${formatDateTime(r.createdAt)}`}
        meta={<StatusPill status={r.status} />}
      />

      {r.status === 'approved' && r.canExecute ? (
        <Notice tone="success">
          Approved. Run it now — it executes exactly as approved, once.
          <div className="mt-3">
            <Button size="sm" loading={execute.isPending} onClick={() => execute.mutate()}>
              Execute
            </Button>
          </div>
        </Notice>
      ) : null}
      {execute.isSuccess ? <Notice tone="success">Executed.</Notice> : null}
      <MutationError error={execute.error ?? cancel.error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Justification">
            <p className="whitespace-pre-wrap text-sm">{r.justification}</p>
            {r.ticketId ? (
              <p className="mt-2 text-sm">
                Ticket:{' '}
                <Link className="text-accent hover:underline" to={`/support/tickets/${r.ticketId}`}>
                  {r.ticketId}
                </Link>
              </p>
            ) : null}
            {r.targetOrgId ? (
              <p className="mt-1 text-sm">
                Tenant:{' '}
                <Link className="text-accent hover:underline" to={`/tenants/${r.targetOrgId}`}>
                  {r.targetOrgId}
                </Link>
              </p>
            ) : null}
          </SectionCard>
          <SectionCard title="What will happen">
            {r.payload.path ? (
              <>
                <p className="font-mono text-xs">
                  {r.payload.method} {r.payload.path}
                </p>
                {r.payload.sensitive ? <p className="mt-2 text-xs text-text-muted">Contains secrets — stored encrypted; preview is redacted.</p> : null}
                <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-bg-elevated p-3 text-xs">
                  {JSON.stringify(r.payload.bodyPreview ?? r.payload.query ?? {}, null, 2)}
                </pre>
              </>
            ) : (
              <pre className="max-h-80 overflow-auto rounded-lg bg-bg-elevated p-3 text-xs">{JSON.stringify(r.payload.summary ?? {}, null, 2)}</pre>
            )}
            {r.executionResult ? (
              <>
                <p className="mt-4 text-xs text-text-muted">Execution result</p>
                <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-bg-elevated p-3 text-xs">{JSON.stringify(r.executionResult, null, 2)}</pre>
              </>
            ) : null}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title={`Decisions (${approvals}/${r.requiredApprovals})`}>
            <ul className="space-y-3 text-sm">
              {r.decisions.map((d) => (
                <li key={d.approverId}>
                  <p>
                    <StatusPill status={d.decision} /> {personLabel(d.approver)}
                  </p>
                  {d.comment ? <p className="mt-1 text-xs text-text-secondary">“{d.comment}”</p> : null}
                  <p className="text-[11px] text-text-muted">{formatDateTime(d.createdAt)}</p>
                </li>
              ))}
              {r.decisions.length === 0 ? <li className="text-text-muted">No decisions yet.</li> : null}
            </ul>
            <p className="mt-4 text-xs text-text-muted">
              Eligible approvers: {r.approvers.map((a) => personLabel(a)).join(', ') || '—'}
            </p>
            <p className="mt-1 text-xs text-text-muted">Expires {formatDateTime(r.expiresAt)}</p>
          </SectionCard>

          {r.status === 'pending' ? (
            <SectionCard title="Your decision">
              {r.canDecide ? (
                <div className="space-y-3">
                  <textarea
                    className={`${inputClass} min-h-20`}
                    placeholder="Comment (required to reject)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="success" loading={decide.isPending} onClick={() => decide.mutate('approved')}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!comment.trim() || decide.isPending}
                      onClick={() => decide.mutate('rejected')}
                    >
                      Reject
                    </Button>
                  </div>
                  <MutationError error={decide.error} />
                </div>
              ) : (
                <p className="text-sm text-text-muted">{r.decideBlocker}</p>
              )}
            </SectionCard>
          ) : null}

          {mine && (r.status === 'pending' || r.status === 'approved') ? (
            <Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Withdraw request
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
