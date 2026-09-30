import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@cullinos/ui';
import { RKYVES_BRAND } from '@/lib/api';
import { PLATFORM_ROLE_LABELS, useCan, type PlatformPermission } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';
import { UserAvatar, UserMenu } from './UserMenu';

type NavChild = { to: string; label: string; permission: PlatformPermission };
type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  external?: boolean;
  permission?: PlatformPermission;
  children?: NavChild[];
};

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true, permission: 'dashboard.read' },
  { to: '/tenants', label: 'Tenants', permission: 'tenants.read' },
  { to: '/labs', label: 'Tenant labs', permission: 'labs.sql' },
  { to: '/plans', label: 'Plans', permission: 'plans.read' },
  { to: '/subscriptions', label: 'Subscriptions', permission: 'subscriptions.manage' },
  { to: '/audit', label: 'Audit & activity', permission: 'audit.read' },
  { to: '/users-report', label: 'Users report', permission: 'tenants.read' },
  {
    to:
      (import.meta.env.VITE_APP_OPS_URL?.trim() ||
        (import.meta.env.PROD ? 'https://app.cullinos.com' : 'http://localhost:5184')).replace(
        /\/$/,
        '',
      ),
    label: 'Cullinos App Ops',
    external: true,
    permission: 'guest_ops.manage',
  },
  { to: '/promo-email', label: 'Promo email', permission: 'promo.send' },
  { to: '/team', label: 'Platform team', permission: 'team.manage' },
  { to: '/settings', label: 'Settings', permission: 'settings.manage' },
  { to: '/health', label: 'System health', permission: 'health.read' },
  {
    to: '/marketing',
    label: 'Marketing CMS',
    children: [
      { to: '/marketing', label: 'Overview', permission: 'marketing.manage' },
      { to: '/marketing/inquiries', label: 'Inquiries', permission: 'marketing.inquiries' },
      { to: '/marketing/media', label: 'Media', permission: 'marketing.manage' },
      { to: '/marketing/hero', label: 'Hero', permission: 'marketing.manage' },
      { to: '/marketing/pages', label: 'Pages', permission: 'marketing.manage' },
      { to: '/marketing/theme', label: 'Theme', permission: 'marketing.manage' },
      { to: '/marketing/pricing', label: 'Pricing', permission: 'marketing.manage' },
      { to: '/marketing/testimonials', label: 'Testimonials', permission: 'marketing.manage' },
      { to: '/marketing/navigation', label: 'Navigation', permission: 'marketing.manage' },
      { to: '/marketing/blog', label: 'Blog', permission: 'marketing.manage' },
      { to: '/marketing/design-lab', label: 'Design lab', permission: 'marketing.manage' },
    ],
  },
];

function visibleNav(can: ReturnType<typeof useCan>): NavItem[] {
  return navItems.flatMap((item) => {
    if (item.children) {
      const children = item.children.filter((c) => can(c.permission));
      return children.length ? [{ ...item, children }] : [];
    }
    return !item.permission || can(item.permission) ? [item] : [];
  });
}

function pathMatchesChild(pathname: string, hash: string, childTo: string) {
  const [childPath, childHash] = childTo.split('#');
  const hashClean = hash.replace(/^#/, '');
  if (childHash) {
    return pathname === childPath && hashClean === childHash;
  }
  if (childPath === '/settings') return false;
  return pathname === childPath;
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const admin = useAuthStore((s) => s.admin);
  const logout = useAuthStore((s) => s.logout);
  const can = useCan();
  const marketingOpen = location.pathname.startsWith('/marketing');

  function handleLogout() {
    logout();
    navigate('/login');
    onNavigate?.();
  }

  return (
    <>
      <div className="border-b border-line-subtle p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary font-mono text-sm font-bold text-text-primary">
            R
          </div>
          <div>
            <p className="font-semibold">{RKYVES_BRAND.name}</p>
            <p className="text-xs text-text-muted">{RKYVES_BRAND.tagline}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-text-muted">{RKYVES_BRAND.product} tenant operations</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleNav(can).map((item) => {
          const isMarketing = item.label === 'Marketing CMS';
          const sectionOpen = isMarketing ? marketingOpen : false;

          if (item.external) {
            return (
              <div key={item.to + item.label}>
                <a
                  href={item.to}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onNavigate}
                  className="block rounded-lg px-3 py-2.5 text-sm text-text-secondary transition hover:bg-hover hover:text-text-primary"
                >
                  {item.label} ↗
                </a>
              </div>
            );
          }

          return (
            <div key={item.to + item.label}>
              <NavLink
                to={item.children?.[0]?.to ?? item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2.5 text-sm transition ${
                    sectionOpen || (!item.children && isActive)
                      ? 'bg-brand-primary/15 font-medium text-brand-primary'
                      : 'text-text-secondary hover:bg-hover hover:text-text-primary'
                  }`
                }
              >
                {item.label}
              </NavLink>
              {item.children && sectionOpen ? (
                <div className="ml-3 mt-1 space-y-0.5 border-l border-line pl-2">
                  {item.children.map((child) => {
                    const childActive = pathMatchesChild(
                      location.pathname,
                      location.hash,
                      child.to,
                    );
                    return (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.to === '/marketing'}
                        onClick={onNavigate}
                        className={() =>
                          `block rounded-md px-2 py-1.5 text-xs transition ${
                            childActive
                              ? 'bg-hover font-medium text-brand-primary'
                              : 'text-text-muted hover:text-text-primary'
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-line-subtle p-4">
        <NavLink
          to="/profile"
          onClick={onNavigate}
          className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-hover"
        >
          <UserAvatar
            name={admin?.name || admin?.email || ''}
            avatarUrl={admin?.avatarUrl}
            size={36}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{admin?.name ?? admin?.email}</span>
            <span className="block truncate text-xs text-text-muted">{admin?.email}</span>
          </span>
        </NavLink>
        {admin?.platformRole ? (
          <p className="mt-1 text-xs text-brand-primary">
            {PLATFORM_ROLE_LABELS[admin.platformRole]}
          </p>
        ) : null}
        <ThemeToggle variant="segmented" className="mt-3" />
        <div className="mt-3 flex gap-4">
          <NavLink
            to="/change-password"
            onClick={onNavigate}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            Change password
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line-subtle bg-bg-secondary lg:flex">
        <SidebarNav />
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 animate-fade-in bg-scrim"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex h-full w-[min(18rem,85vw)] animate-slide-in-left flex-col border-r border-line-subtle bg-bg-secondary shadow-xl">
            <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line-subtle px-4 sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            className="rounded-lg border border-line p-2 text-text-secondary lg:hidden"
            onClick={() => setMobileNavOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <p className="text-sm font-medium lg:hidden">Platform admin</p>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle className="lg:hidden" />
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div key={location.pathname.split('/')[1]} className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
