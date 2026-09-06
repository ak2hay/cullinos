import { useAuthStore } from '@/stores/auth';
import { organizationsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

const SUPER_ADMIN_URL =
  import.meta.env.VITE_SUPER_ADMIN_URL?.replace(/\/$/, '') ?? 'http://localhost:5183';

export function ImpersonationBanner() {
  const impersonation = useAuthStore((s) => s.impersonation);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { data: org } = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
    enabled: impersonation,
  });

  if (!impersonation) return null;

  function exitSession() {
    logout();
    window.location.href = SUPER_ADMIN_URL;
  }

  const orgLabel = org?.name ?? user?.organizationName;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-600 px-4 py-2 text-sm text-black">
      <p>
        Support session
        {orgLabel ? ` · ${orgLabel}` : null}
        {user?.email ? ` as ${user.email}` : null}
      </p>
      <button
        type="button"
        onClick={exitSession}
        className="rounded bg-black/20 px-3 py-1 font-medium hover:bg-black/30"
      >
        Exit support session
      </button>
    </div>
  );
}
