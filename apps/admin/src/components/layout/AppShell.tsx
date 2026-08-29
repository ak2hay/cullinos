import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CULLINOS_BRAND } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { OutletSelector } from './OutletSelector';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/menu', label: 'Menu' },
  { to: '/orders', label: 'Orders' },
  { to: '/tables', label: 'Tables' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/customers', label: 'Customers' },
  { to: '/staff', label: 'Staff' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
];

export function AppShell() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/5 bg-bg-secondary">
        <div className="border-b border-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary font-mono font-bold text-bg-primary">
              C
            </div>
            <div>
              <p className="font-semibold">{CULLINOS_BRAND.name}</p>
              <p className="text-xs text-text-muted">Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-white/5 px-6">
          <div>
            <p className="text-sm text-text-muted">Outlet</p>
            <OutletSelector />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
