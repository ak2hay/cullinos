import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut, UserRound } from 'lucide-react';
import { ThemeToggle } from '@cullinos/ui';
import { useDismiss } from '@/components/ui/RowActions';
import { resolveUploadUrl } from '@/lib/api';
import { PLATFORM_ROLE_LABELS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';
import { EntityAvatar } from '@/components/ui/EntityAvatar';

export function UserAvatar({
  name,
  avatarUrl,
  size = 32,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  return (
    <span className="inline-flex">
      <AvatarInner name={name} src={resolveUploadUrl(avatarUrl)} size={size} />
    </span>
  );
}

function AvatarInner({ name, src, size }: { name: string; src: string; size: number }) {
  if (src) return <EntityAvatar name={name} src={src} size={size} rounded="lg" />;
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-accent font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('') || '?'}
    </span>
  );
}

/** Header account chip: who is signed in, plus profile / password / theme / sign-out. */
export function UserMenu() {
  const navigate = useNavigate();
  const admin = useAuthStore((s) => s.admin);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const rootRef = useDismiss(open, () => setOpen(false));

  if (!admin) return null;
  const displayName = admin.name || admin.email;
  const role = admin.platformRole ? PLATFORM_ROLE_LABELS[admin.platformRole] : 'Platform staff';
  const itemClass =
    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-hover hover:text-text-primary';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 text-left hover:bg-hover"
      >
        <UserAvatar name={displayName} avatarUrl={admin.avatarUrl} size={36} />
        <span className="hidden min-w-0 md:block">
          <span className="block max-w-[11rem] truncate text-sm font-semibold leading-tight">{displayName}</span>
          <span className="block text-xs text-text-muted">{role}</span>
        </span>
        <ChevronDown size={16} className="hidden text-text-muted md:block" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 animate-fade-in rounded-xl border border-line bg-bg-secondary p-2 shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-line-subtle px-2 pb-3 pt-1">
            <UserAvatar name={displayName} avatarUrl={admin.avatarUrl} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-text-muted">
                {admin.employeeCode ? `${admin.employeeCode} · ` : ''}
                {admin.email}
              </p>
              <p className="truncate text-xs font-medium text-accent">{role}</p>
            </div>
          </div>
          <div className="space-y-0.5 py-2">
            <Link role="menuitem" to="/profile" className={itemClass} onClick={() => setOpen(false)}>
              <UserRound size={16} aria-hidden="true" />
              My profile & sessions
            </Link>
            <Link role="menuitem" to="/change-password" className={itemClass} onClick={() => setOpen(false)}>
              <KeyRound size={16} aria-hidden="true" />
              Change password
            </Link>
          </div>
          <div className="border-t border-line-subtle px-2 py-3">
            <p className="mb-2 text-xs font-medium text-text-muted">Appearance</p>
            <ThemeToggle variant="segmented" />
          </div>
          <div className="border-t border-line-subtle pt-2">
            <button
              type="button"
              role="menuitem"
              className={`${itemClass} hover:!text-status-error`}
              onClick={() => {
                setOpen(false);
                logout();
                navigate('/login');
              }}
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
