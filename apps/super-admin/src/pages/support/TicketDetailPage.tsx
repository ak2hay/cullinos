import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Dialog } from '@cullinos/ui';
import { PageHeader, SectionCard, StatusPill } from '@/components/ui';
import { inputClass, LabeledInput, MutationError, Notice } from '@/components/common';
import { StaffPicker } from '@/components/StaffPicker';
import { superAdminApi } from '@/lib/api';
import { useCan } from '@/lib/permissions';
import {
  formatDateTime,
  iamApi,
  personLabel,
  supportApi,
  type AccessGrant,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/platform-api';
import { useAuthStore } from '@/stores/auth';

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
const OPEN: TicketStatus[] = ['open', 'in_progress', 'waiting_customer'];

function GrantRequestDialog({ ticketId, open, onClose }: { ticketId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [accessLevel, setAccessLevel] = useState<'read_only' | 'full'>('read_only');
  const [minutes, setMinutes] = useState(60);
  const [justification, setJustification] = useState('');
  const request = useMutation({
    mutationFn: () => supportApi.requestGrant(ticketId, { accessLevel, durationMinutes: minutes, justification: justification.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'ticket', ticketId] });
      setJustification('');
      onClose();
    },
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request tenant access"
      description="Access is tied to this ticket, time-boxed, and every action you take inside the tenant is logged with your employee ID."
      footer={
        <Button size="sm" loading={request.isPending} disabled={justification.trim().length < 15} onClick={() => request.mutate()}>
          Request
        </Button>
      }
    >
      <div className="space-y-3">
        <LabeledInput label="Access level">
          <select className={inputClass} value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as 'read_only' | 'full')}>
            <option value="read_only">Read-only (view, cannot change anything)</option>
            <option value="full">Full (can make changes)</option>
          </select>
        </LabeledInput>
        <LabeledInput label="Duration">
          <select className={inputClass} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {[15, 30, 60, 120, 240, 480].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`}
              </option>
            ))}
          </select>
        </LabeledInput>
        <LabeledInput label="Justification" hint="What you will check or fix, and why it needs tenant access (min 15 characters).">
          <textarea className={`${inputClass} min-h-24`} value={justification} onChange={(e) => setJustification(e.target.value)} />
        </LabeledInput>
        <MutationError error={request.error} />
      </div>
    </Dialog>
  );
}

export function GrantActions({ grant, onChange }: { grant: AccessGrant; onChange: () => void }) {
  const me = useAuthStore((s) => s.admin);
  const can = useCan();
  const [message, setMessage] = useState<string | null>(null);
  const openSession = useMutation({
    mutationFn: () => superAdminApi.impersonateOrganization(grant.organizationId, grant.id),
    onSuccess: (res) => {
      window.open(res.adminUrl, '_blank', 'noopener,noreferrer');
      setMessage(`Opened ${res.accessLevel === 'full' ? 'full' : 'read-only'} session as ${res.user.email} until ${formatDateTime(res.expiresAt)}.`);
      onChange();
    },
  });
  const revoke = useMutation({ mutationFn: () => supportApi.revokeGrant(grant.id), onSuccess: onChange });
  const active = grant.status === 'active' && grant.expiresAt && new Date(grant.expiresAt) > new Date();
  const mine = grant.userId === me?.id;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {active && mine ? (
          <Button size="sm" loading={openSession.isPending} onClick={() => openSession.mutate()}>
            Open tenant
          </Button>
        ) : null}
        {(grant.status === 'active' || grant.status === 'pending') && (mine || can('tenant_access.revoke')) ? (
          <Button size="sm" variant="ghost" loading={revoke.isPending} onClick={() => revoke.mutate()}>
            {mine ? 'End access' : 'Revoke'}
          </Button>
        ) : null}
        {grant.approvalRequestId && grant.status === 'pending' ? (
          <Link to={`/approvals/${grant.approvalRequestId}`} className="self-center text-xs text-accent hover:underline">
            Approval request
          </Link>
        ) : null}
      </div>
      {message ? <p className="text-xs text-status-success">{message}</p> : null}
      <MutationError error={openSession.error ?? revoke.error} />
    </div>
  );
}

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const can = useCan();
  const me = useAuthStore((s) => s.admin);
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(true);
  const [grantOpen, setGrantOpen] = useState(false);
  const [reassign, setReassign] = useState(false);
  const key = ['super-admin', 'ticket', id];
  const query = useQuery({ queryKey: key, queryFn: () => supportApi.ticket(id), enabled: Boolean(id) });
  const teams = useQuery({ queryKey: ['super-admin', 'iam', 'teams'], queryFn: iamApi.teams });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['super-admin', 'tickets'] });
  };
  const update = useMutation({
    mutationFn: (b: Parameters<typeof supportApi.updateTicket>[1]) => supportApi.updateTicket(id, b),
    onSuccess: () => {
      setReassign(false);
      refresh();
    },
  });
  const addComment = useMutation({
    mutationFn: () => supportApi.comment(id, { body: comment.trim(), isInternal: internal }),
    onSuccess: () => {
      setComment('');
      refresh();
    },
  });

  const t = query.data;
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!t) return <Notice tone="error">{(query.error as Error)?.message ?? 'Ticket not found'}</Notice>;
  const isOpen = OPEN.includes(t.status);
  const canWrite = can('tickets.write');

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Support' }, { label: 'Tickets', to: '/support/tickets' }, { label: t.ref }]}
        title={t.subject}
        description={`${t.ref} · Opened ${formatDateTime(t.createdAt)} by ${personLabel(t.createdBy)}`}
        meta={
          <>
            <StatusPill status={t.priority} />
            <StatusPill status={t.status} />
            {t.slaBreached ? <StatusPill status="breached" label="SLA breached" tone="error" /> : null}
          </>
        }
      />
      <MutationError error={update.error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Description">
            <p className="whitespace-pre-wrap text-sm">{t.description}</p>
          </SectionCard>
          <SectionCard title={`Conversation (${t.comments.length})`}>
            <ul className="space-y-4">
              {t.comments.map((c) => (
                <li key={c.id} className={`rounded-lg border p-3 ${c.isInternal ? 'border-status-warning/30 bg-status-warning/5' : 'border-line-subtle'}`}>
                  <p className="text-xs text-text-muted">
                    {personLabel(c.author)} · {formatDateTime(c.createdAt)} {c.isInternal ? '· internal note' : ''}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                </li>
              ))}
            </ul>
            {canWrite ? (
              <div className="mt-4 space-y-2">
                <textarea className={`${inputClass} min-h-24`} placeholder="Add a note or reply…" value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
                    <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                    Internal note
                  </label>
                  <Button size="sm" loading={addComment.isPending} disabled={!comment.trim()} onClick={() => addComment.mutate()}>
                    Post
                  </Button>
                </div>
                <MutationError error={addComment.error} />
              </div>
            ) : null}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Details">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-text-muted">Tenant</dt>
                <dd>
                  {t.organization ? (
                    <Link to={`/tenants/${t.organization.id}`} className="text-accent hover:underline">
                      {t.organization.name}
                    </Link>
                  ) : (
                    'Not linked'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Requester</dt>
                <dd>{[t.requesterName, t.requesterEmail, t.requesterPhone].filter(Boolean).join(' · ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Assignee</dt>
                <dd className="flex items-center justify-between gap-2">
                  <span>{personLabel(t.assignee)}</span>
                  {canWrite && t.assigneeUserId !== me?.id ? (
                    <button type="button" className="text-xs text-accent hover:underline" onClick={() => update.mutate({ assigneeUserId: me?.id ?? null })}>
                      Take it
                    </button>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Team</dt>
                <dd>{t.assigneeTeam?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">SLA due · first response</dt>
                <dd>
                  {formatDateTime(t.slaDueAt)} · {formatDateTime(t.firstResponseAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Staff actions logged</dt>
                <dd>
                  <Link to={`/activity?ticketId=${t.id}`} className="text-accent hover:underline">
                    {t.activityCount} entries
                  </Link>
                </dd>
              </div>
            </dl>
            {canWrite ? (
              <div className="mt-4 space-y-2">
                <select className={inputClass} value={t.status} onChange={(e) => update.mutate({ status: e.target.value as TicketStatus })}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <select className={inputClass} value={t.priority} onChange={(e) => update.mutate({ priority: e.target.value as TicketPriority })}>
                  {['low', 'normal', 'high', 'urgent'].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {can('tickets.assign') ? (
                  reassign ? (
                    <div className="space-y-2">
                      <select
                        className={inputClass}
                        value={t.assigneeTeamId ?? ''}
                        onChange={(e) => update.mutate({ assigneeTeamId: e.target.value || null })}
                      >
                        <option value="">No team</option>
                        {(teams.data ?? []).map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.name}
                          </option>
                        ))}
                      </select>
                      <StaffPicker value={null} onChange={(v) => v && update.mutate({ assigneeUserId: v.userId })} />
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setReassign(true)}>
                      Reassign
                    </Button>
                  )
                ) : null}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Tenant access"
            actions={
              can('tenants.impersonate') && isOpen && t.organizationId ? (
                <Button size="sm" onClick={() => setGrantOpen(true)}>
                  Request access
                </Button>
              ) : null
            }
          >
            {!t.organizationId ? <p className="text-sm text-text-muted">Link a tenant to request access.</p> : null}
            <ul className="space-y-4">
              {t.accessGrants.map((g) => (
                <li key={g.id} className="space-y-1 border-b border-line-subtle pb-3 text-sm last:border-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <StatusPill status={g.status} />
                    <Badge variant={g.accessLevel === 'full' ? 'warning' : 'neutral'}>{g.accessLevel.replace('_', '-')}</Badge>
                    <span>{personLabel(g.employee)}</span>
                  </p>
                  <p className="text-xs text-text-secondary">{g.justification}</p>
                  <p className="text-xs text-text-muted">
                    {g.durationMinutes} min{g.expiresAt ? ` · until ${formatDateTime(g.expiresAt)}` : ''}
                  </p>
                  <GrantActions grant={g} onChange={refresh} />
                </li>
              ))}
              {t.accessGrants.length === 0 && t.organizationId ? <li className="text-sm text-text-muted">No access requested.</li> : null}
            </ul>
          </SectionCard>
        </div>
      </div>
      <GrantRequestDialog ticketId={t.id} open={grantOpen} onClose={() => setGrantOpen(false)} />
    </div>
  );
}
