import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AlarmClock,
  BookOpen,
  CalendarClock,
  Clock3,
  Headset,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { ThemeToggle, cn } from '@cullinos/ui';
import { Avatar } from '@/components/common';
import { StepUpDialog } from '@/components/StepUpDialog';
import { agentApi, type AgentTicketFilter } from '@/lib/support-api';
import { useCanAgent, useSession } from '@/stores/session';

export type QueueId = 'mine' | 'unassigned' | 'open' | 'waiting' | 'breached' | 'resolved' | 'all';

export const QUEUES: Array<{ id: QueueId; label: string; icon: typeof Inbox; filter: AgentTicketFilter }> = [
  { id: 'mine', label: 'My work', icon: UserRound, filter: { assignee: 'me', status: 'open_all' } },
  { id: 'unassigned', label: 'Unassigned', icon: Inbox, filter: { assignee: 'unassigned', status: 'open_all' } },
  { id: 'open', label: 'All open', icon: ListChecks, filter: { status: 'open_all' } },
  { id: 'waiting', label: 'Awaiting customer', icon: Clock3, filter: { status: 'waiting_customer' } },
  { id: 'breached', label: 'Breached SLA', icon: AlarmClock, filter: { breached: true } },
  { id: 'resolved', label: 'Resolved', icon: Users, filter: { status: 'resolved' } },
  { id: 'all', label: 'All tickets', icon: ListChecks, filter: {} },
];

const COUNTED: QueueId[] = ['mine', 'unassigned', 'breached'];

const OPS_LINKS: Array<{ to: string; label: string; icon: typeof Inbox; permission: string[] }> = [
  { to: '/agent/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: ['reports.read'] },
  { to: '/agent/grants', label: 'Tenant access grants', icon: KeyRound, permission: ['tenants.impersonate', 'tenant_access.revoke', 'tickets.read'] },
  { to: '/agent/shifts', label: 'Shifts & on-call', icon: CalendarClock, permission: ['directory.read', 'tickets.read'] },
];

function QueueCount({ id }: { id: QueueId }) {
  const q = QUEUES.find((x) => x.id === id)!;
  const res = useQuery({
    queryKey: ['agent', 'queue-count', id],
    queryFn: () => agentApi.tickets({ ...q.filter, limit: 200 }),
    refetchInterval: 60_000,
  });
  const n = res.data?.data.length ?? 0;
  if (!n) return null;
  return (
    <span
      className={cn(
        'ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        id === 'breached' ? 'bg-status-error/15 text-status-error' : 'bg-accent/15 text-accent',
      )}
    >
      {n >= 200 ? '200+' : n}
    </span>
  );
}

export function AgentShell() {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const can = useCanAgent();
  const [search, setSearch] = useState('');
  const [navOpen, setNavOpen] = useState(false);

  const nav = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-3 flex items-center gap-2 px-2 py-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Headset size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-sm font-semibold leading-tight">Cullinos Support</p>
          <p className="text-xs text-text-muted">Agent workspace</p>
        </div>
      </div>
      {can('tickets.write') ? (
        <NavLink
          to="/agent/tickets/new"
          onClick={() => setNavOpen(false)}
          className="mb-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-primary px-3 text-sm font-medium text-on-brand hover:bg-brand-primary-dark"
        >
          <Plus size={16} aria-hidden="true" />
          New ticket
        </NavLink>
      ) : null}
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Queues</p>
      {QUEUES.map((q) => (
        <NavLink
          key={q.id}
          to={`/agent/queue/${q.id}`}
          onClick={() => setNavOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition',
              isActive ? 'bg-accent/12 font-medium text-accent' : 'text-text-secondary hover:bg-hover hover:text-text-primary',
            )
          }
        >
          <q.icon size={16} aria-hidden="true" />
          {q.label}
          {COUNTED.includes(q.id) ? <QueueCount id={q.id} /> : null}
        </NavLink>
      ))}
      <p className="mt-4 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Self-service</p>
      <NavLink
        to="/agent/knowledge"
        onClick={() => setNavOpen(false)}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition',
            isActive ? 'bg-accent/12 font-medium text-accent' : 'text-text-secondary hover:bg-hover hover:text-text-primary',
          )
        }
      >
        <BookOpen size={16} aria-hidden="true" />
        Knowledge base
      </NavLink>
      <p className="mt-4 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Operations</p>
      {OPS_LINKS.filter((l) => l.permission.some((p) => can(p))).map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          onClick={() => setNavOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition',
              isActive ? 'bg-accent/12 font-medium text-accent' : 'text-text-secondary hover:bg-hover hover:text-text-primary',
            )
          }
        >
          <l.icon size={16} aria-hidden="true" />
          {l.label}
        </NavLink>
      ))}
      <div className="mt-auto flex items-center gap-2 rounded-lg border border-line-subtle p-2">
        <Avatar name={user?.name ?? 'Agent'} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-text-muted capitalize">{user?.platformRole ?? 'staff'}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-hover hover:text-text-primary"
        >
          <LogOut size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line-subtle bg-bg-secondary lg:block">{nav}</aside>
      {navOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-scrim" onClick={() => setNavOpen(false)} />
          <aside className="relative h-full w-[min(17rem,85vw)] bg-bg-secondary shadow-xl">
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-hover"
            >
              <X size={16} aria-hidden="true" />
            </button>
            {nav}
          </aside>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line-subtle bg-bg-secondary px-4">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line lg:hidden"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
          <form
            className="relative max-w-md flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/agent/queue/all?q=${encodeURIComponent(search.trim())}`);
            }}
          >
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets: TKT-000123, subject or email"
              className="h-9 w-full rounded-lg border border-line bg-bg-card pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </form>
          <div className="ml-auto">
            <ThemeToggle variant="icon" />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
        <StepUpDialog />
      </div>
    </div>
  );
}
