import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { Button, Dialog } from '@cullinos/ui';
import { Label, Notice, inputClass, textareaClass } from '@/components/common';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { GRANT_DURATIONS, agentApi, type AccessGrant } from '@/lib/support-api';
import { useCanAgent, useSession } from '@/stores/session';

const ADMIN_URL = ((import.meta.env.VITE_ADMIN_URL as string | undefined)?.trim() || 'https://admin.cullinos.com').replace(/\/$/, '');

function durationLabel(m: number) {
  return m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`;
}

function useCountdown(until: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [until]);
  if (!until) return null;
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${h ? `${h}h ` : ''}${m}m ${String(s).padStart(2, '0')}s left`;
}

export function isGrantActive(g: AccessGrant) {
  return g.status === 'active' && Boolean(g.expiresAt) && new Date(g.expiresAt!).getTime() > Date.now();
}

export function GrantRequestDialog({ ticketId, open, onClose, onDone }: { ticketId: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const [accessLevel, setAccessLevel] = useState<'read_only' | 'full'>('read_only');
  const [minutes, setMinutes] = useState(60);
  const [justification, setJustification] = useState('');
  const request = useMutation({
    mutationFn: () => agentApi.requestGrant(ticketId, { accessLevel, durationMinutes: minutes, justification: justification.trim() }),
    onSuccess: () => {
      setJustification('');
      onDone();
      onClose();
    },
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request tenant access"
      description="Access is tied to this ticket, time-boxed (max 4 hours), and every action inside the tenant is logged with your employee ID."
      footer={
        <Button size="sm" loading={request.isPending} disabled={justification.trim().length < 15} onClick={() => request.mutate()}>
          Request
        </Button>
      }
    >
      <div className="space-y-3">
        <Label label="Access level">
          <select className={inputClass} value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as 'read_only' | 'full')}>
            <option value="read_only">Read-only (view, cannot change anything)</option>
            <option value="full">Full (can make changes)</option>
          </select>
        </Label>
        <Label label="Window">
          <select className={inputClass} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {GRANT_DURATIONS.map((m) => (
              <option key={m} value={m}>
                {durationLabel(m)}
              </option>
            ))}
          </select>
        </Label>
        <Label label="Justification" hint="What you will check or fix, and why it needs tenant access (min 15 characters).">
          <textarea className={`${textareaClass} min-h-24`} value={justification} onChange={(e) => setJustification(e.target.value)} />
        </Label>
        {request.error ? <Notice tone="error">{errorMessage(request.error)}</Notice> : null}
      </div>
    </Dialog>
  );
}

/** Generate / show / revoke the support login password for one of my active grants. */
function SupportPasswordPanel({ grant }: { grant: AccessGrant }) {
  const qc = useQueryClient();
  const key = ['agent', 'support-password', grant.id];
  const [targetUserId, setTargetUserId] = useState('');
  const [revealed, setRevealed] = useState<{ password: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const current = useQuery({ queryKey: key, queryFn: () => agentApi.supportPassword(grant.id) });
  const users = useQuery({
    queryKey: ['agent', 'tenant-users', grant.organizationId],
    queryFn: () => agentApi.tenantUsers(grant.organizationId),
  });
  const create = useMutation({
    mutationFn: () => agentApi.createSupportPassword(grant.id, targetUserId || undefined),
    onSuccess: (res) => {
      setRevealed({ password: res.password, email: res.targetUser?.email ?? '' });
      setCopied(false);
      qc.invalidateQueries({ queryKey: key });
    },
  });
  const revoke = useMutation({
    mutationFn: () => agentApi.revokeSupportPassword(grant.id),
    onSuccess: () => {
      setRevealed(null);
      qc.invalidateQueries({ queryKey: key });
    },
  });
  const pw = current.data;
  const countdown = useCountdown(pw?.active ? pw.expiresAt : null);
  const activeUsers = (users.data ?? []).filter((u) => u.status === 'active');

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-line-subtle p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
        <KeyRound size={13} aria-hidden="true" />
        Support login password
      </p>
      {pw?.active ? (
        <p className="text-xs text-text-muted">
          Active for {pw.targetUser?.email ?? 'tenant user'} · {countdown} · used {pw.useCount}×
        </p>
      ) : (
        <p className="text-xs text-text-muted">
          A temporary password for the tenant login page. The tenant's own password is not changed. It works until this grant ends.
        </p>
      )}
      {revealed ? (
        <div className="space-y-1.5 rounded-md bg-bg-elevated p-2">
          <p className="text-xs text-text-muted">Shown once. Sign in at the tenant login page with:</p>
          <p className="text-xs">
            Email: <span className="font-mono">{revealed.email}</span>
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-bg-card px-2 py-1 font-mono text-sm">{revealed.password}</code>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line hover:bg-hover"
              aria-label="Copy password"
              title="Copy password"
              onClick={() => {
                void navigator.clipboard.writeText(revealed.password).then(() => setCopied(true));
              }}
            >
              <Copy size={13} aria-hidden="true" />
            </button>
          </div>
          {copied ? <p className="text-xs text-status-success">Copied</p> : null}
          <a href={`${ADMIN_URL}/login`} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
            Open tenant login page
          </a>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputClass} h-8 w-auto max-w-[14rem] text-xs`} value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
          <option value="">Tenant owner (default)</option>
          {activeUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.email}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" loading={create.isPending} onClick={() => create.mutate()}>
          {pw?.active ? 'Regenerate' : 'Generate password'}
        </Button>
        {pw?.active ? (
          <Button size="sm" variant="ghost" loading={revoke.isPending} onClick={() => revoke.mutate()}>
            Revoke password
          </Button>
        ) : null}
      </div>
      {create.error || revoke.error ? <Notice tone="error">{errorMessage(create.error ?? revoke.error)}</Notice> : null}
    </div>
  );
}

export function GrantActions({ grant, onChange, showPassword = true }: { grant: AccessGrant; onChange: () => void; showPassword?: boolean }) {
  const me = useSession((s) => s.user);
  const can = useCanAgent();
  const [message, setMessage] = useState<string | null>(null);
  const openSession = useMutation({
    mutationFn: () => agentApi.impersonate(grant.organizationId, grant.id),
    onSuccess: (res) => {
      window.open(res.adminUrl, '_blank', 'noopener,noreferrer');
      setMessage(`Opened ${res.accessLevel === 'full' ? 'full' : 'read-only'} session as ${res.user.email} until ${formatDateTime(res.expiresAt)}.`);
      onChange();
    },
  });
  const revoke = useMutation({ mutationFn: () => agentApi.revokeGrant(grant.id), onSuccess: onChange });
  const active = isGrantActive(grant);
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
        {grant.status === 'pending' ? <span className="self-center text-xs text-text-muted">Waiting for approval</span> : null}
      </div>
      {message ? <p className="text-xs text-status-success">{message}</p> : null}
      {openSession.error || revoke.error ? <Notice tone="error">{errorMessage(openSession.error ?? revoke.error)}</Notice> : null}
      {showPassword && active && mine ? <SupportPasswordPanel grant={grant} /> : null}
    </div>
  );
}
