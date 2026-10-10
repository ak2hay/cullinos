import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChefHat,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from 'lucide-react';
import { CommandPalette, cn, type CommandPaletteItem } from '@cullinos/ui';
import { GovernanceDialogs } from '@/components/governance/GovernanceDialogs';
import { ElevationDialog } from '@/components/governance/ElevationDialog';
import { useAccessSync } from '@/hooks/useAccessSync';
import { superAdminApi } from '@/lib/api';
import { useCan } from '@/lib/permissions';
import { approvalsApi } from '@/lib/platform-api';
import { useAuthStore } from '@/stores/auth';
import { findNavLeaf, NAV, type NavEntry, type NavLeaf } from './nav';
import { NotificationsBell } from './NotificationsBell';
import { UserMenu } from './UserMenu';

const RAIL_KEY = 'cullinos-super-admin-rail';
const OPEN_KEY = 'cullinos-super-admin-nav-open';

function useVisibleNav(): NavEntry[] {
  const can = useCan();
  const allowed = (leaf: NavLeaf) => !leaf.permission || can(leaf.permission);
  return NAV.flatMap((entry): NavEntry[] => {
    if (entry.kind === 'leaf') return allowed(entry) ? [entry] : [];
    const children = entry.children.filter(allowed);
    return children.length ? [{ ...entry, children }] : [];
  });
}

function usePendingApprovals() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['super-admin', 'approvals', 'count'],
    queryFn: approvalsApi.count,
    enabled: Boolean(token),
    refetchInterval: 45_000,
  }).data?.count;
}

function readSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="ml-auto rounded-full bg-status-error px-1.5 text-[10px] font-semibold leading-[18px] text-white">
      {value > 99 ? '99+' : value}
    </span>
  );
}

function PlatformHealthCard({ rail }: { rail: boolean }) {
  const can = useCan();
  const enabled = can('health.read');
  const { data, isError } = useQuery({
    queryKey: ['super-admin', 'health'],
    queryFn: superAdminApi.health,
    enabled,
    refetchInterval: 60_000,
  });
  if (!enabled) return null;
  const ok = data?.status === 'ok' && !isError;
  const label = !data && !isError ? 'Checking…' : ok ? 'All systems operational' : 'Attention needed';
  const dot = cn('h-2.5 w-2.5 shrink-0 rounded-full', ok ? 'bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.2)]' : data || isError ? 'bg-amber-400' : 'bg-slate-500');
  if (rail) {
    return (
      <Link to="/health" title={`Platform health: ${label}`} className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg hover:bg-sidebar-hover">
        <span className={dot} />
      </Link>
    );
  }
  return (
    <Link
      to="/health"
      className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-white/[0.03] px-3 py-3 transition hover:bg-sidebar-hover"
    >
      <span className={dot} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-sidebar-fg">Platform Health</span>
        <span className="block truncate text-[11px] text-sidebar-muted">{label}</span>
      </span>
      <ChevronRight size={14} className="text-sidebar-muted" aria-hidden="true" />
    </Link>
  );
}

function SidebarContent({
  rail,
  onNavigate,
  onToggleRail,
  pending,
}: {
  rail: boolean;
  onNavigate?: () => void;
  onToggleRail?: () => void;
  pending?: number;
}) {
  const location = useLocation();
  const entries = useVisibleNav();
  const active = findNavLeaf(location.pathname);
  const [open, setOpen] = useState<Set<string>>(() => readSet(OPEN_KEY));

  function toggleGroup(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const rowBase = 'group flex w-full items-center gap-3 rounded-lg text-sm transition-colors';
  const rowPad = rail ? 'h-10 justify-center px-0' : 'px-3 py-2';
  const idle = 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg';
  const activeCls = 'bg-sidebar-active font-medium text-sidebar-active-fg shadow-[inset_0_0_0_1px_var(--color-sidebar-active-border)]';

  return (
    <div className="flex h-full flex-col bg-sidebar-bg text-sidebar-fg">
      <div className={cn('flex h-16 shrink-0 items-center gap-3', rail ? 'justify-center px-2' : 'px-5')}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
          <ChefHat size={20} aria-hidden="true" />
        </span>
        {!rail ? (
          <div className="min-w-0">
            <p className="font-display text-[17px] font-bold leading-tight tracking-tight text-white">Cullinos</p>
            <p className="text-xs text-sidebar-muted">Super Admin</p>
          </div>
        ) : null}
      </div>

      <nav aria-label="Main" className="sa-scroll flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {entries.map((entry) => {
          const Icon = entry.icon;
          if (entry.kind === 'leaf') {
            const isActive = active?.entryId === entry.id;
            const badge = entry.badge === 'approvals' && pending ? pending : 0;
            return (
              <NavLink
                key={entry.id}
                to={entry.to}
                end={entry.end}
                onClick={onNavigate}
                title={rail ? entry.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={cn(rowBase, rowPad, 'relative', isActive ? activeCls : idle)}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
                {!rail ? <span className="truncate">{entry.label}</span> : null}
                {badge ? (
                  rail ? (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-status-error" />
                  ) : (
                    <CountBadge value={badge} />
                  )
                ) : null}
              </NavLink>
            );
          }
          const groupActive = active?.entryId === entry.id;
          const expanded = !rail && (open.has(entry.id) || groupActive);
          return (
            <div key={entry.id}>
              <button
                type="button"
                title={rail ? entry.label : undefined}
                aria-expanded={rail ? undefined : expanded}
                onClick={() => (rail ? onToggleRail?.() : toggleGroup(entry.id))}
                className={cn(rowBase, rowPad, groupActive ? 'text-sidebar-fg' : idle)}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
                {!rail ? (
                  <>
                    <span className="truncate">{entry.label}</span>
                    <ChevronDown
                      size={15}
                      aria-hidden="true"
                      className={cn('ml-auto shrink-0 transition-transform', expanded ? 'rotate-180' : '')}
                    />
                  </>
                ) : null}
              </button>
              {expanded ? (
                <div className="mb-1 ml-[21px] mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                  {entry.children.map((leaf) => {
                    if (leaf.external) {
                      return (
                        <a
                          key={leaf.to}
                          href={leaf.to}
                          target="_blank"
                          rel="noreferrer"
                          onClick={onNavigate}
                          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
                        >
                          {leaf.label}
                          <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      );
                    }
                    const isActive = active?.leaf.to === leaf.to;
                    return (
                      <NavLink
                        key={leaf.to}
                        to={leaf.to}
                        onClick={onNavigate}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'block truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                          isActive ? 'bg-sidebar-active font-medium text-sidebar-active-fg' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg',
                        )}
                      >
                        {leaf.label}
                      </NavLink>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className={cn('shrink-0 space-y-2 border-t border-sidebar-border p-3', rail && 'px-2')}>
        <PlatformHealthCard rail={rail} />
        {onToggleRail ? (
          <button
            type="button"
            onClick={onToggleRail}
            aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg py-2 text-xs text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg',
              rail ? 'justify-center' : 'px-3',
            )}
          >
            {rail ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
            {!rail ? 'Collapse' : null}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [elevationOpen, setElevationOpen] = useState(false);
  const [rail, setRail] = useState(() => localStorage.getItem(RAIL_KEY) === '1');
  const [paletteQuery, setPaletteQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const can = useCan();
  const entries = useVisibleNav();
  const pending = usePendingApprovals();
  useAccessSync();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(paletteQuery.trim()), 250);
    return () => window.clearTimeout(t);
  }, [paletteQuery]);

  const tenantSearch = useQuery({
    queryKey: ['super-admin', 'organizations', 'palette', debouncedQuery],
    queryFn: () => superAdminApi.listOrganizations(1, 6, { q: debouncedQuery }),
    enabled: paletteOpen && debouncedQuery.length >= 2 && can('tenants.read'),
    staleTime: 30_000,
  });

  function toggleRail() {
    setRail((r) => {
      localStorage.setItem(RAIL_KEY, r ? '0' : '1');
      return !r;
    });
  }

  const onPaletteQuery = useCallback((q: string) => setPaletteQuery(q), []);

  const paletteItems = useMemo<CommandPaletteItem[]>(() => {
    const tenants: CommandPaletteItem[] =
      debouncedQuery.length >= 2
        ? (tenantSearch.data?.data ?? []).map((t) => ({
            id: `tenant:${t.id}`,
            label: t.name,
            group: 'Tenants',
            keywords: `${debouncedQuery} ${t.slug} ${t.email ?? ''}`,
            icon: <Building2 size={15} />,
            onSelect: () => navigate(`/tenants/${t.id}`),
          }))
        : [];
    const pages = entries.flatMap((entry) => {
      const leaves = entry.kind === 'leaf' ? [entry] : entry.children;
      const group = entry.kind === 'leaf' ? (entry.section ?? 'Pages') : entry.label;
      return leaves.map((leaf) => ({
        id: `page:${leaf.to}`,
        label: leaf.label,
        group,
        keywords: leaf.keywords,
        onSelect: () => (leaf.external ? window.open(leaf.to, '_blank', 'noopener') : navigate(leaf.to)),
      }));
    });
    return [
      ...tenants,
      ...pages,
      {
        id: 'action:elevate',
        label: 'Request temporary access',
        group: 'Actions',
        keywords: 'elevation jit role',
        onSelect: () => setElevationOpen(true),
      },
      { id: 'action:profile', label: 'My profile & sessions', group: 'Actions', onSelect: () => navigate('/profile') },
    ];
  }, [entries, navigate, tenantSearch.data, debouncedQuery]);

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border transition-[width] duration-200 lg:block',
          rail ? 'w-[72px]' : 'w-64',
        )}
      >
        <SidebarContent rail={rail} pending={pending} onToggleRail={toggleRail} />
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 animate-fade-in bg-scrim"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative h-full w-[min(17rem,85vw)] animate-slide-in-left shadow-xl">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-sidebar-muted hover:bg-sidebar-hover"
            >
              <X size={18} />
            </button>
            <SidebarContent rail={false} pending={pending} onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line-subtle bg-bg-secondary/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            className="rounded-lg border border-line p-2 text-text-secondary hover:bg-hover lg:hidden"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={18} />
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-transparent bg-bg-elevated px-3.5 text-left text-sm text-text-muted transition hover:border-line sm:max-w-md lg:max-w-xl"
          >
            <Search size={16} aria-hidden="true" className="shrink-0" />
            <span className="truncate">Search restaurants, owners, emails, pages…</span>
            <kbd className="ml-auto hidden shrink-0 rounded-md border border-line bg-bg-card px-1.5 py-0.5 font-sans text-[10px] font-medium sm:inline">
              Ctrl K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {pending ? (
              <Link
                to="/approvals"
                className="hidden rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-1.5 text-xs font-medium text-status-warning hover:bg-status-warning/15 xl:block"
              >
                {pending} awaiting approval
              </Link>
            ) : null}
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div key={location.pathname.split('/')[1]} className="mx-auto w-full max-w-[1440px] animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
        onQueryChange={onPaletteQuery}
        placeholder="Search tenants, pages or actions…"
      />
      <ElevationDialog open={elevationOpen} onClose={() => setElevationOpen(false)} />
      <GovernanceDialogs />
    </div>
  );
}
