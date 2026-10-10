import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { Button, cn } from '@cullinos/ui';
import {
  AttachmentList,
  Avatar,
  Label,
  Notice,
  Panel,
  StatusBadge,
  parseAttachmentLines,
  textareaClass,
} from '@/components/common';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { CATEGORY_LABELS, customerApi, type CustomerTicketDetail } from '@/lib/support-api';

const OPEN = ['open', 'in_progress', 'waiting_customer'];

function Rating({ t, onSaved }: { t: CustomerTicketDetail; onSaved: (d: CustomerTicketDetail) => void }) {
  const [score, setScore] = useState(t.satisfaction ?? 0);
  const [comment, setComment] = useState(t.satisfactionComment ?? '');
  const rate = useMutation({ mutationFn: () => customerApi.rate(t.id, score, comment || undefined), onSuccess: onSaved });
  return (
    <Panel title={t.satisfaction ? 'Your rating' : 'How did we do?'}>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={score === n} aria-label={`${n} star`} onClick={() => setScore(n)}>
            <Star size={24} className={n <= score ? 'fill-amber-400 text-amber-400' : 'text-line-strong'} aria-hidden="true" />
          </button>
        ))}
      </div>
      <textarea
        className={`${textareaClass} mt-3 min-h-16`}
        placeholder="Anything we could do better? (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="mt-2 flex items-center justify-between">
        {rate.isSuccess ? <span className="text-xs text-status-success">Thanks for the feedback.</span> : <span />}
        <Button size="sm" disabled={!score} loading={rate.isPending} onClick={() => rate.mutate()}>
          {t.satisfaction ? 'Update rating' : 'Submit rating'}
        </Button>
      </div>
      {rate.error ? <Notice tone="error">{errorMessage(rate.error)}</Notice> : null}
    </Panel>
  );
}

export function PortalTicketPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const created = (location.state as { created?: boolean } | null)?.created;
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [links, setLinks] = useState('');
  const key = ['portal', 'ticket', id];
  const query = useQuery({ queryKey: key, queryFn: () => customerApi.ticket(id), enabled: Boolean(id), refetchInterval: 30_000 });
  const apply = (d: CustomerTicketDetail) => {
    qc.setQueryData(key, d);
    qc.invalidateQueries({ queryKey: ['portal', 'tickets'] });
  };
  const reply = useMutation({
    mutationFn: () => customerApi.comment(id, { body: body.trim(), attachments: parseAttachmentLines(links) }),
    onSuccess: (d) => {
      apply(d);
      setBody('');
      setLinks('');
    },
  });
  const status = useMutation({
    mutationFn: (action: 'close' | 'reopen') => customerApi.setStatus(id, action),
    onSuccess: apply,
  });

  const t = query.data;
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!t) return <Notice tone="error">{errorMessage(query.error) ?? 'Ticket not found'}</Notice>;
  const isOpen = OPEN.includes(t.status);

  return (
    <div className="space-y-4">
      <div>
        <Link to="/tickets" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
          <ArrowLeft size={14} aria-hidden="true" />
          All tickets
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-text-muted">{t.ref}</p>
            <h1 className="font-display text-xl font-semibold">{t.subject}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <StatusBadge status={t.status} />
              <span>{CATEGORY_LABELS[t.category] ?? t.category}</span>
              <span>· Opened {formatDateTime(t.createdAt)}</span>
              {t.assigneeName ? <span>· Handled by {t.assigneeName}</span> : null}
            </div>
          </div>
          {isOpen ? (
            <Button
              size="sm"
              variant="secondary"
              loading={status.isPending}
              onClick={() => {
                if (window.confirm('Close this ticket? You can reopen it later.')) status.mutate('close');
              }}
            >
              Close ticket
            </Button>
          ) : (
            <Button size="sm" variant="secondary" loading={status.isPending} onClick={() => status.mutate('reopen')}>
              Reopen ticket
            </Button>
          )}
        </div>
      </div>

      {created ? <Notice tone="success">Ticket submitted. We will email you when our team replies.</Notice> : null}
      {t.status === 'waiting_customer' ? <Notice>Our team is waiting for your reply.</Notice> : null}
      {status.error ? <Notice tone="error">{errorMessage(status.error)}</Notice> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Conversation">
            <ol className="space-y-4">
              <li className="flex gap-3">
                <Avatar name={t.requesterName ?? 'You'} size={30} />
                <div className="min-w-0 flex-1 rounded-lg border border-line-subtle p-3">
                  <p className="text-xs text-text-muted">
                    <span className="font-semibold text-text-primary">{t.requesterName ?? 'You'}</span> · {formatDateTime(t.createdAt)}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm">{t.description}</p>
                </div>
              </li>
              {t.comments.map((c) => (
                <li key={c.id} className={cn('flex gap-3', !c.fromCustomer && 'flex-row-reverse')}>
                  <Avatar name={c.authorName} size={30} />
                  <div
                    className={cn(
                      'min-w-0 flex-1 rounded-lg border p-3',
                      c.fromCustomer ? 'border-line-subtle' : 'border-accent/30 bg-accent/5',
                    )}
                  >
                    <p className="text-xs text-text-muted">
                      <span className="font-semibold text-text-primary">{c.authorName}</span> · {formatDateTime(c.createdAt)}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm">{c.body}</p>
                    <AttachmentList items={c.attachments} />
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          {t.status !== 'closed' ? (
            <Panel title="Reply">
              <div className="space-y-3">
                <textarea
                  className={`${textareaClass} min-h-28`}
                  placeholder="Add more detail or answer our team's question…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <Label label="Links to screenshots or files (optional)" hint='One per line: "Bill photo | https://…"'>
                  <textarea className={`${textareaClass} min-h-14`} value={links} onChange={(e) => setLinks(e.target.value)} />
                </Label>
                <div className="flex justify-end">
                  <Button size="sm" loading={reply.isPending} disabled={!body.trim()} onClick={() => reply.mutate()}>
                    Send reply
                  </Button>
                </div>
                {reply.error ? <Notice tone="error">{errorMessage(reply.error)}</Notice> : null}
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4">
          <Panel title="Details">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-text-muted">Status</dt>
                <dd>
                  <StatusBadge status={t.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Raised by</dt>
                <dd>{t.requesterName ?? '—'}</dd>
                <dd className="text-xs text-text-muted">{t.requesterEmail}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Last update</dt>
                <dd>{formatDateTime(t.updatedAt)}</dd>
              </div>
              {t.resolvedAt ? (
                <div>
                  <dt className="text-xs text-text-muted">Resolved</dt>
                  <dd>{formatDateTime(t.resolvedAt)}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>
          {!isOpen ? <Rating key={`${t.id}-${t.satisfaction ?? 0}`} t={t} onSaved={apply} /> : null}
        </div>
      </div>
    </div>
  );
}
