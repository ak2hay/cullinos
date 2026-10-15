import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Notice, Panel } from '@/components/common';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { agentApi } from '@/lib/support-api';

function hours(v: number | null) {
  return v === null ? '—' : v < 1 ? `${Math.round(v * 60)} min` : `${v} h`;
}

function Kpi({ label, value, hint, to, danger }: { label: string; value: ReactNode; hint?: string; to?: string; danger?: boolean }) {
  const body = (
    <>
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold tabular-nums ${danger ? 'text-status-error' : ''}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </>
  );
  const cls = 'block rounded-xl border border-line-subtle bg-bg-card p-4';
  return to ? (
    <Link to={to} className={`${cls} hover:border-accent/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between">
            <span>{r.label}</span>
            <span className="text-text-secondary">{r.value}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-hover">
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {rows.length === 0 ? <li className="text-sm text-text-muted">No data.</li> : null}
    </ul>
  );
}

export function AgentDashboardPage() {
  const query = useQuery({ queryKey: ['agent', 'ops-overview'], queryFn: agentApi.overview, refetchInterval: 120_000 });
  const d = query.data;
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!d) return <Notice tone="error">{errorMessage(query.error) ?? 'Could not load the overview'}</Notice>;
  const openTickets = Object.values(d.tickets.openByPriority).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Support dashboard</h1>
        <p className="text-sm text-text-secondary">Ticket load, SLAs, approvals and tenant access · updated {formatDateTime(d.generatedAt)}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Open tickets"
          value={openTickets}
          hint={`${d.tickets.openByPriority.urgent ?? 0} critical · ${d.tickets.openByPriority.high ?? 0} high`}
          to="/agent/queue/open"
        />
        <Kpi label="SLA breached" value={d.tickets.slaBreached} danger={d.tickets.slaBreached > 0} to="/agent/queue/breached" />
        <Kpi label="Avg first response (30d)" value={hours(d.tickets.avgFirstResponseHours)} />
        <Kpi label="Avg resolution (30d)" value={hours(d.tickets.avgResolutionHours)} hint={`${d.tickets.resolvedLast30d} resolved`} />
        <Kpi label="Pending approvals" value={d.approvals.pending} />
        <Kpi
          label="Approval turnaround (30d)"
          value={hours(d.approvals.avgTurnaroundHours)}
          hint={`${d.approvals.decidedLast30d} decided · ${d.approvals.rejectedLast30d} rejected`}
        />
        <Kpi label="Active tenant access" value={d.tenantAccess.active} to="/agent/grants?status=active" />
        <Kpi label="Staff actions (24h)" value={d.staff.actionsLast24h} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Open tickets by team">
          <Bars rows={d.tickets.byTeam.map((t) => ({ label: t.team, value: t.open }))} />
        </Panel>
        <Panel title="Workload by person (top 10)">
          <Bars rows={d.tickets.byAssignee.map((a) => ({ label: a.name, value: a.open }))} />
        </Panel>
      </div>
    </div>
  );
}
