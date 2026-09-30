import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resolveUploadUrl } from '@/lib/api';
import { PLATFORM_ROLE_LABELS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';

export function UserAvatar({
  name,
  avatarUrl,
  size = 32,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const src = resolveUploadUrl(avatarUrl);
  useEffect(() => setBroken(false), [src]);
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-primary/20 font-semibold text-brand-primary"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}

/** Header account button: who is signed in, plus profile / password / sign-out. */
export function UserMenu() {
  const navigate = useNavigate();
  const admin = useAuthStore((s) => s.admin);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!admin) return null;
  const displayName = admin.name || admin.email;
  const itemClass =
    'block w-full rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-hover hover:text-text-primary';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-line bg-bg-elevated py-1 pl-1 pr-3 text-sm hover:border-line-strong"
      >
        <UserAvatar name={displayName} avatarUrl={admin.avatarUrl} size={28} />
        <span className="hidden max-w-[10rem] truncate font-medium sm:inline">{displayName}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-line bg-bg-secondary p-2 shadow-xl"
        >
          <div className="flex items-center gap-3 border-b border-line-subtle px-2 pb-3 pt-1">
            <UserAvatar name={displayName} avatarUrl={admin.avatarUrl} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-text-muted">{admin.email}</p>
              {admin.platformRole ? (
                <p className="truncate text-xs text-brand-primary">
                  {PLATFORM_ROLE_LABELS[admin.platformRole]}
                </p>
              ) : null}
            </div>
          </div>
          <div className="pt-2">
            <Link role="menuitem" to="/profile" className={itemClass} onClick={() => setOpen(false)}>
              My profile
            </Link>
            <Link
              role="menuitem"
              to="/change-password"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              Change password
            </Link>
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                logout();
                navigate('/login');
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
