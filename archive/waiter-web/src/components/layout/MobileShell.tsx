import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@cullinos/ui';
import { useWaiterSocket } from '@/hooks/useWaiterSocket';
import { useAuthStore } from '@/stores/auth';

export function MobileShell() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { latestCall, dismissLatestCall } = useWaiterSocket();

  function handleLogout() {
    logout();
    navigate('/login');
  }

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
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </header>

      {latestCall ? (
        <div className="border-b border-status-warning/40 bg-status-warning/15 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-status-warning">
              {latestCall.tableName} is calling
            </p>
            <button
              type="button"
              onClick={dismissLatestCall}
              className="text-xs text-text-secondary underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <main className="flex-1 overflow-y-auto pb-safe">
        <Outlet />
      </main>
    </div>
  );
}
