import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CULLINOS_BRAND } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { BrandSelector } from './BrandSelector';
import { OutletSelector } from './OutletSelector';

const navItems = [
  { to: '/', label: 'Overview', end: true },
  { to: '/reports', label: 'Reports' },
  { to: '/comparison', label: 'Outlet comparison' },
  { to: '/stock-transfer', label: 'Stock transfer' },
  { to: '/franchise', label: 'Franchise' },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    navigate('/login');
    onNavigate?.();
  }

  return (
    <>
      <div className="border-b border-white/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary font-mono font-bold text-bg-primary">
            M
          </div>
          <div>
            <p className="font-semibold">{CULLINOS_BRAND.name}</p>
            <p className="text-xs text-text-muted">Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2.5 text-sm transition ${
                isActive
                  ? 'bg-brand-primary/15 font-medium text-brand-primary'
                  : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/5 p-4">
        <p className="truncate text-sm font-medium">
          {user?.firstName} {user?.lastName}
        </p>
        <p className="truncate text-xs text-text-muted">{user?.email}</p>
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
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/5 bg-bg-secondary lg:flex">
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
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-white/5 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              className="rounded-lg border border-white/10 p-2 text-text-secondary lg:hidden"
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
            <div className="flex flex-wrap items-end gap-4 sm:gap-6">
              <div>
                <p className="text-xs text-text-muted">Brand</p>
                <BrandSelector />
              </div>
              <div>
                <p className="text-xs text-text-muted">Outlet</p>
                <OutletSelector />
              </div>
            </div>
          </div>
          <p className="text-xs text-text-muted">Enterprise console</p>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
