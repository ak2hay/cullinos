import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { RKYVES_BRAND } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const navItems: Array<{
  to: string;
  label: string;
  end?: boolean;
  external?: boolean;
  children?: Array<{ to: string; label: string }>;
}> = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/tenants', label: 'Tenants' },
  { to: '/labs', label: 'Tenant labs' },
  { to: '/plans', label: 'Plans' },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/audit', label: 'Audit & activity' },
  { to: '/users-report', label: 'Users report' },
  {
    to:
      (import.meta.env.VITE_APP_OPS_URL?.trim() ||
        (import.meta.env.PROD ? 'https://app.cullinos.com' : 'http://localhost:5184')).replace(
        /\/$/,
        '',
      ),
    label: 'Cullinos App Ops',
    external: true,
  },
  { to: '/promo-email', label: 'Promo email' },
  { to: '/settings', label: 'Settings' },
  { to: '/health', label: 'System health' },
  {
    to: '/marketing',
    label: 'Marketing CMS',
    children: [
      { to: '/marketing', label: 'Overview' },
      { to: '/marketing/media', label: 'Media' },
      { to: '/marketing/hero', label: 'Hero' },
      { to: '/marketing/pages', label: 'Pages' },
      { to: '/marketing/theme', label: 'Theme' },
      { to: '/marketing/pricing', label: 'Pricing' },
      { to: '/marketing/testimonials', label: 'Testimonials' },
      { to: '/marketing/navigation', label: 'Navigation' },
      { to: '/marketing/blog', label: 'Blog' },
      { to: '/marketing/design-lab', label: 'Design lab' },
    ],
  },
];

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
  const marketingOpen = location.pathname.startsWith('/marketing');

  function handleLogout() {
    logout();
    navigate('/login');
    onNavigate?.();
  }

  return (
    <>
      <div className="border-b border-white/5 p-5">
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
        {navItems.map((item) => {
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
                  className="block rounded-lg px-3 py-2.5 text-sm text-text-secondary transition hover:bg-white/5 hover:text-text-primary"
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
                      : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                  }`
                }
              >
                {item.label}
              </NavLink>
              {item.children && sectionOpen ? (
                <div className="ml-3 mt-1 space-y-0.5 border-l border-white/10 pl-2">
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
                              ? 'bg-white/5 font-medium text-brand-primary'
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

      <div className="border-t border-white/5 p-4">
        <p className="truncate text-sm font-medium">{admin?.name ?? admin?.email}</p>
        <p className="truncate text-xs text-text-muted">{admin?.email}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 text-sm text-text-secondary hover:text-text-primary"
        >
          Sign out
        </button>
      </div>
    </>
  );
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-bg-secondary lg:flex">
        <SidebarNav />
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex h-full w-[min(18rem,85vw)] flex-col border-r border-white/5 bg-bg-secondary shadow-xl">
            <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-white/5 px-4 lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            className="rounded-lg border border-white/10 p-2 text-text-secondary"
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
          <p className="ml-3 text-sm font-medium">Platform admin</p>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
