import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';


import { KpiCard, PageHeader, SectionCard } from '@/components/ui';
import { formatDateTime, reportsApi } from '@/lib/platform-api';

function hours(v: number | null) {
  return v === null ? '—' : v < 1 ? `${Math.round(v * 60)} min` : `${v} h`;
}

function Bars({ rows }: { rows: { label: string; value: number; to?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between">
            {r.to ? (
              <Link to={r.to} className="hover:text-accent">
                {r.label}
              </Link>
            ) : (
              <span>{r.label}</span>
            )}
            <span className="text-text-secondary">{r.value}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-hover-strong">
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {rows.length === 0 ? <li className="text-sm text-text-muted">No data.</li> : null}
    </ul>
  );
}

export function OpsOverviewPage() {
  const query = useQuery({ queryKey: ['super-admin', 'ops-overview'], queryFn: reportsApi.overview, refetchInterval: 120_000 });
  const d = query.data;
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!d) return <p className="text-sm text-status-error">{(query.error as Error)?.message}</p>;
  const openTickets = Object.values(d.tickets.openByPriority).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Operations overview" description={`Support load, approvals and tenant health · updated ${formatDateTime(d.generatedAt)}`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open tickets" value={<Link to="/support/tickets">{openTickets}</Link>} hint={`${d.tickets.openByPriority.urgent ?? 0} urgent · ${d.tickets.openByPriority.high ?? 0} high`} />
        <KpiCard
          label="SLA breached"
          value={<Link to="/support/tickets?breached=true" className={d.tickets.slaBreached ? 'text-status-error' : ''}>{d.tickets.slaBreached}</Link>}
        />
        <KpiCard label="Avg first response (30d)" value={hours(d.tickets.avgFirstResponseHours)} />
        <KpiCard label="Avg resolution (30d)" value={hours(d.tickets.avgResolutionHours)} hint={`${d.tickets.resolvedLast30d} resolved`} />
        <KpiCard label="Pending approvals" value={<Link to="/approvals?box=all&status=pending">{d.approvals.pending}</Link>} />
        <KpiCard
          label="Approval turnaround (30d)"
          value={hours(d.approvals.avgTurnaroundHours)}
          hint={`${d.approvals.decidedLast30d} decided · ${d.approvals.rejectedLast30d} rejected`}
        />
        <KpiCard label="Active tenant access" value={<Link to="/support/grants?status=active">{d.tenantAccess.active}</Link>} />
        <KpiCard label="Staff actions (24h)" value={<Link to="/activity">{d.staff.actionsLast24h}</Link>} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Open tickets by team">
          <Bars rows={d.tickets.byTeam.map((t) => ({ label: t.team, value: t.open, to: t.teamId ? `/support/tickets?teamId=${t.teamId}` : undefined }))} />
        </SectionCard>
        <SectionCard title="Workload by person (top 10)">
          <Bars rows={d.tickets.byAssignee.map((a) => ({ label: a.name, value: a.open, to: a.userId ? `/support/tickets?assignee=${a.userId}` : undefined }))} />
        </SectionCard>
        <SectionCard title="Tenants">
          <Bars rows={Object.entries(d.tenants.byStatus).map(([k, v]) => ({ label: k, value: v }))} />
          <p className="mt-3 text-xs text-text-muted">{d.tenants.newLast30d} new in the last 30 days</p>
        </SectionCard>
        <SectionCard title="Staff by department">
          <Bars rows={d.staff.byDepartment.map((s) => ({ label: s.department, value: s.count }))} />
        </SectionCard>
      </div>
    </div>
  );
}
