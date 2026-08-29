import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { RKYVES_BRAND } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const navItems = [
  { to: '/', label: 'Tenants', end: true },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/health', label: 'System health' },
];

export function AppShell() {
  const navigate = useNavigate();
  const admin = useAuthStore((s) => s.admin);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/5 bg-bg-secondary">
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
          <p className="mt-3 text-xs text-text-muted">
            {RKYVES_BRAND.product} tenant operations
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive
                    ? 'bg-white/10 font-medium text-text-primary'
                    : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
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
      </aside>

      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
