import { Link } from 'react-router-dom';
import { PLATFORM_ROLE_LABELS, useCan, type PlatformPermission } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';

export function RequirePermission({
  permission,
  children,
}: {
  permission: PlatformPermission | readonly PlatformPermission[];
  children: React.ReactNode;
}) {
  const can = useCan();
  const role = useAuthStore((s) => s.admin?.platformRole);

  if (can(permission)) return children;

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-white/10 bg-bg-secondary p-6">
      <h1 className="text-lg font-semibold">No access</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Your platform role{role ? ` (${PLATFORM_ROLE_LABELS[role]})` : ''} does not include this
        section. Ask a platform Owner if you need it.
      </p>
      <Link to="/" className="mt-4 inline-block text-sm text-brand-primary hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
