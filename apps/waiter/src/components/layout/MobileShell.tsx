import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Form';
import { useAuthStore } from '@/stores/auth';

export function MobileShell() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-bg-secondary/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-left"
        >
          <p className="text-sm font-semibold text-brand-primary">Cullinos Waiter</p>
          <p className="text-xs text-text-secondary">
            {user ? `${user.firstName}` : 'Staff'}
          </p>
        </button>
        <Button variant="ghost" size="sm" onClick={logout}>
          Logout
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto pb-safe">
        <Outlet />
      </main>
    </div>
  );
}
