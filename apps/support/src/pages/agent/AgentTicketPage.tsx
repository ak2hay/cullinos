import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ExternalLink, Lock, MessageSquare, RotateCcw, Star, UserCheck } from 'lucide-react';
import { Button, cn } from '@cullinos/ui';
import {
  AttachmentList,
  Avatar,
  Label,
  Notice,
  Panel,
  PriorityBadge,
  SlaBadge,
  StatusBadge,
  inputClass,
  parseAttachmentLines,
  textareaClass,
} from '@/components/common';
import { errorMessage } from '@/lib/api';
import { formatDateTime, personName, relativeTime } from '@/lib/format';
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  agentApi,
  type AgentTicketDetail,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/support-api';
import { GrantActions, GrantRequestDialog, isGrantActive } from '@/components/TenantAccess';
import { useCanAgent, useSession } from '@/stores/session';

const PLATFORM_URL = (import.meta.env.VITE_PLATFORM_URL as string | undefined)?.trim() || 'https://platform.cullinos.com';
const OPEN: TicketStatus[] = ['open', 'in_progress', 'waiting_customer'];

function StaffPicker({ onPick }: { onPick: (userId: string) => void }) {
  const [q, setQ] = useState('');
  const results = useQuery({
    queryKey: ['agent', 'staff', q],
    queryFn: () => agentApi.staff(q),
    enabled: q.trim().length >= 2,
  });
  return (
    <div className="relative">
      <input className={inputClass} placeholder="Search staff by name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim().length >= 2 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-bg-card shadow-lg">
          {(results.data?.data ?? []).map((s) => (
            <li key={s.userId}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-hover"
                onClick={() => {
                  onPick(s.userId);
                  setQ('');
                }}
              >
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-xs text-text-muted">{s.employeeCode} · {s.email}</span>
              </button>
            </li>
          ))}
          {results.data && results.data.data.length === 0 ? <li className="px-3 py-2 text-sm text-text-muted">No matches</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Activity({ t }: { t: AgentTicketDetail }) {
  const items = [
    ...t.comments.map((c) => ({ kind: 'comment' as const, at: c.createdAt, c })),
    { kind: 'created' as const, at: t.createdAt },
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return (
    <ol className="space-y-4">
      {items.map((it) =>
        it.kind === 'created' ? (
          <li key="created" className="flex gap-3 text-xs text-text-muted">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-line-strong" />
            Ticket created {t.channel === 'portal' ? 'from the support portal' : `by ${personName(t.createdBy)}`} · {formatDateTime(t.createdAt)}
          </li>
        ) : (
          <li key={it.c.id} className="flex gap-3">
            <Avatar name={it.c.fromCustomer ? (t.requesterName ?? 'Customer') : personName(it.c.author)} size={30} />
            <div
              className={cn(
                'min-w-0 flex-1 rounded-lg border p-3',
                it.c.isInternal && 'border-status-warning/30 bg-status-warning/5',
                !it.c.isInternal && it.c.fromCustomer && 'border-sky-500/30 bg-sky-500/5',
                !it.c.isInternal && !it.c.fromCustomer && 'border-line-subtle',
              )}
            >
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
                <span className="font-semibold text-text-primary">
                  {it.c.fromCustomer ? (t.requesterName ?? 'Customer') : personName(it.c.author)}
                </span>
                <span>{it.c.isInternal ? 'Work note (internal)' : it.c.fromCustomer ? 'Customer reply' : 'Additional comment (customer visible)'}</span>
                <span>· {formatDateTime(it.c.createdAt)}</span>
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm">{it.c.body}</p>
              <AttachmentList items={it.c.attachments} />
            </div>
          </li>
        ),
      )}
    </ol>
  );
}

export function AgentTicketPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const can = useCanAgent();
  const me = useSession((s) => s.user);
  const [tab, setTab] = useState<'comment' | 'note'>('comment');
  const [body, setBody] = useState('');
  const [links, setLinks] = useState('');
  const [awaitAfterReply, setAwaitAfterReply] = useState(true);
  const [reassign, setReassign] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);

  const key = ['agent', 'ticket', id];
  const query = useQuery({ queryKey: key, queryFn: () => agentApi.ticket(id), enabled: Boolean(id) });
  const teams = useQuery({ queryKey: ['agent', 'teams'], queryFn: agentApi.teams, enabled: can('tickets.assign') });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['agent', 'tickets'] });
    qc.invalidateQueries({ queryKey: ['agent', 'queue-count'] });
  };
  const update = useMutation({
    mutationFn: (b: Parameters<typeof agentApi.update>[1]) => agentApi.update(id, b),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      setReassign(false);
      refresh();
    },
  });
  const post = useMutation({
    mutationFn: async () => {
      const isInternal = tab === 'note';
      const res = await agentApi.comment(id, { body: body.trim(), isInternal, attachments: parseAttachmentLines(links) });
      if (!isInternal && awaitAfterReply && OPEN.includes(res.status) && res.status !== 'waiting_customer') {
        return agentApi.update(id, { status: 'waiting_customer' });
      }
      return res;
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      setBody('');
      setLinks('');
      refresh();
    },
  });

  const t = query.data;
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!t) return <Notice tone="error">{errorMessage(query.error) ?? 'Ticket not found'}</Notice>;
  const isOpen = OPEN.includes(t.status);
  const canWrite = can('tickets.write');
  const hasLiveGrant = t.accessGrants.some((g) => g.userId === me?.id && (g.status === 'pending' || isGrantActive(g)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/agent/queue/mine" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to queue
          </Link>
          <p className="mt-1 font-mono text-xs text-text-muted">{t.ref}</p>
          <h1 className="font-display text-xl font-semibold">{t.subject}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            <PriorityBadge priority={t.priority} />
            <SlaBadge due={t.slaDueAt} done={!isOpen} />
            {t.channel === 'portal' ? <span className="text-xs text-text-muted">Raised via support portal</span> : null}
          </div>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            {t.assigneeUserId !== me?.id && isOpen ? (
              <Button size="sm" variant="secondary" className="gap-1.5" loading={update.isPending} onClick={() => update.mutate({ assigneeUserId: me?.id ?? null })}>
                <UserCheck size={15} aria-hidden="true" />
                Assign to me
              </Button>
            ) : null}
            {isOpen ? (
              <Button size="sm" className="gap-1.5" loading={update.isPending} onClick={() => update.mutate({ status: 'resolved' })}>
                <CheckCircle2 size={15} aria-hidden="true" />
                Resolve
              </Button>
            ) : (
              <Button size="sm" variant="secondary" className="gap-1.5" loading={update.isPending} onClick={() => update.mutate({ status: 'in_progress' })}>
                <RotateCcw size={15} aria-hidden="true" />
                Reopen
              </Button>
            )}
            {t.status === 'resolved' ? (
              <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => update.mutate({ status: 'closed' })}>
                Close
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {update.error ? <Notice tone="error">{errorMessage(update.error)}</Notice> : null}

      <Panel>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="State">
            {canWrite ? (
              <select className={inputClass} value={t.status} onChange={(e) => update.mutate({ status: e.target.value as TicketStatus })}>
                {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            ) : (
              STATUS_LABELS[t.status]
            )}
          </Field>
          <Field label="Priority">
            {canWrite ? (
              <select className={inputClass} value={t.priority} onChange={(e) => update.mutate({ priority: e.target.value as TicketPriority })}>
                {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            ) : (
              PRIORITY_LABELS[t.priority]
            )}
          </Field>
          <Field label="Category">
            {canWrite ? (
              <select className={inputClass} value={t.category} onChange={(e) => update.mutate({ category: e.target.value })}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
                {!CATEGORY_LABELS[t.category] ? <option value={t.category}>{t.category}</option> : null}
              </select>
            ) : (
              (CATEGORY_LABELS[t.category] ?? t.category)
            )}
          </Field>
          <Field label="Assignment group">
            {can('tickets.assign') ? (
              <select
                className={inputClass}
                value={t.assigneeTeamId ?? ''}
                onChange={(e) => update.mutate({ assigneeTeamId: e.target.value || null })}
              >
                <option value="">No group</option>
                {(teams.data ?? []).map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </select>
            ) : (
              (t.assigneeTeam?.name ?? '—')
            )}
          </Field>
          <Field label="Assigned to">
            <div className="flex items-center justify-between gap-2">
              <span>{personName(t.assignee)}</span>
              {can('tickets.assign') && !reassign ? (
                <button type="button" className="text-xs text-accent hover:underline" onClick={() => setReassign(true)}>
                  Change
                </button>
              ) : null}
            </div>
            {reassign ? (
              <div className="mt-2 space-y-1">
                <StaffPicker onPick={(userId) => update.mutate({ assigneeUserId: userId })} />
                <div className="flex gap-3">
                  <button type="button" className="text-xs text-text-muted hover:underline" onClick={() => update.mutate({ assigneeUserId: null })}>
                    Unassign
                  </button>
                  <button type="button" className="text-xs text-text-muted hover:underline" onClick={() => setReassign(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </Field>
          <Field label="Tenant">
            {t.organization ? (
              <a
                href={`${PLATFORM_URL}/tenants/${t.organization.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                {t.organization.name}
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            ) : (
              'Not linked'
            )}
          </Field>
          <Field label="Caller">
            <span className="block">{t.requesterName ?? '—'}</span>
            <span className="block text-xs text-text-muted">{[t.requesterEmail, t.requesterPhone].filter(Boolean).join(' · ')}</span>
          </Field>
          <Field label="Opened · first response">
            <span className="block">{formatDateTime(t.createdAt)}</span>
            <span className="block text-xs text-text-muted">
              {t.firstResponseAt ? `Responded ${relativeTime(t.firstResponseAt)}` : 'No response yet'}
            </span>
          </Field>
        </dl>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Description">
            <p className="whitespace-pre-wrap text-sm">{t.description}</p>
          </Panel>

          {canWrite ? (
            <Panel flush>
              <div className="flex border-b border-line-subtle text-sm" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'comment'}
                  onClick={() => setTab('comment')}
                  className={cn('inline-flex items-center gap-1.5 px-4 py-2.5', tab === 'comment' ? 'border-b-2 border-accent font-medium text-accent' : 'text-text-secondary')}
                >
                  <MessageSquare size={14} aria-hidden="true" />
                  Additional comments (customer visible)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'note'}
                  onClick={() => setTab('note')}
                  className={cn('inline-flex items-center gap-1.5 px-4 py-2.5', tab === 'note' ? 'border-b-2 border-status-warning font-medium text-status-warning' : 'text-text-secondary')}
                >
                  <Lock size={14} aria-hidden="true" />
                  Work notes (internal)
                </button>
              </div>
              <div className="space-y-3 p-4">
                <textarea
                  className={`${textareaClass} min-h-28`}
                  placeholder={tab === 'note' ? 'Internal note, never shown to the customer…' : 'Reply to the customer. They are emailed a copy.'}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <Label label="Attachment links (optional)" hint='One per line: "Screenshot | https://…"'>
                  <textarea className={`${textareaClass} min-h-14`} value={links} onChange={(e) => setLinks(e.target.value)} />
                </Label>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {tab === 'comment' ? (
                    <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
                      <input type="checkbox" checked={awaitAfterReply} onChange={(e) => setAwaitAfterReply(e.target.checked)} />
                      Set state to Awaiting customer
                    </label>
                  ) : (
                    <span />
                  )}
                  <Button size="sm" loading={post.isPending} disabled={!body.trim()} onClick={() => post.mutate()}>
                    {tab === 'note' ? 'Post work note' : 'Post comment'}
                  </Button>
                </div>
                {post.error ? <Notice tone="error">{errorMessage(post.error)}</Notice> : null}
              </div>
            </Panel>
          ) : null}

          <Panel title={`Activity (${t.comments.length})`}>
            <Activity t={t} />
          </Panel>
        </div>

        <div className="space-y-4">
          {t.satisfaction ? (
            <Panel title="Customer satisfaction">
              <p className="flex items-center gap-1" aria-label={`${t.satisfaction} of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={18} className={n <= t.satisfaction! ? 'fill-amber-400 text-amber-400' : 'text-line-strong'} aria-hidden="true" />
                ))}
              </p>
              {t.satisfactionComment ? <p className="mt-2 text-sm text-text-secondary">{t.satisfactionComment}</p> : null}
            </Panel>
          ) : null}
          {t.closedReason ? (
            <Panel title="Close notes">
              <p className="text-sm text-text-secondary">{t.closedReason}</p>
            </Panel>
          ) : null}
          <Panel
            title="Tenant access"
            actions={
              t.organizationId && isOpen && can('tenants.impersonate') && !hasLiveGrant ? (
                <button type="button" className="text-xs text-accent hover:underline" onClick={() => setGrantOpen(true)}>
                  Request access
                </button>
              ) : null
            }
          >
            {t.accessGrants.length === 0 ? (
              <p className="text-sm text-text-muted">
                {t.organizationId ? 'No access grants on this ticket.' : 'Link a tenant to request access.'}
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {t.accessGrants.map((g) => (
                  <li key={g.id} className="space-y-2 border-b border-line-subtle pb-3 last:border-0">
                    <div>
                      <p className="font-medium capitalize">
                        {g.accessLevel.replace('_', '-')} · {g.status}
                      </p>
                      <p className="text-xs text-text-muted">
                        {personName(g.employee)}
                        {g.expiresAt ? ` · until ${formatDateTime(g.expiresAt)}` : ` · ${g.durationMinutes} min requested`}
                      </p>
                    </div>
                    <GrantActions grant={g} onChange={refresh} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <GrantRequestDialog ticketId={t.id} open={grantOpen} onClose={() => setGrantOpen(false)} onDone={refresh} />
          <Panel title="Audit">
            <p className="text-sm text-text-secondary">
              {t.activityCount} staff actions logged against this ticket.{' '}
              <a href={`${PLATFORM_URL}/activity?ticketId=${t.id}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                View
              </a>
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
