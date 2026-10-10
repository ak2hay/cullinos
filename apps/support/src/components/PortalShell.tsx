import { NavLink, Outlet } from 'react-router-dom';
import { Headset, LogOut } from 'lucide-react';
import { ThemeToggle, cn } from '@cullinos/ui';
import { Avatar } from '@/components/common';
import { useSession } from '@/stores/session';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/tickets', label: 'My tickets', end: false },
  { to: '/tickets/new', label: 'Raise a ticket', end: true },
];

export function PortalShell() {
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <header className="sticky top-0 z-30 border-b border-line-subtle bg-bg-secondary">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Headset size={16} aria-hidden="true" />
            </span>
            <span className="hidden font-display text-sm font-semibold sm:inline">Cullinos Support</span>
          </NavLink>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition',
                    isActive ? 'bg-accent/12 font-medium text-accent' : 'text-text-secondary hover:bg-hover hover:text-text-primary',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle variant="icon" />
            <div className="hidden items-center gap-2 md:flex">
              <Avatar name={user?.name ?? 'You'} size={28} />
              <div className="leading-tight">
                <p className="max-w-[10rem] truncate text-sm font-medium">{user?.name}</p>
                <p className="max-w-[10rem] truncate text-xs text-text-muted">{user?.organizationName}</p>
              </div>
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
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-line-subtle py-4 text-center text-xs text-text-muted">Cullinos Support · Powered by Rkyves</footer>
    </div>
  );
}
