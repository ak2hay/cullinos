import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { iamApi } from '@/lib/platform-api';

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['super-admin', 'notifications'],
    queryFn: () => iamApi.notifications(),
    refetchInterval: 45_000,
  });
  const markRead = useMutation({
    mutationFn: (ids?: string[]) => iamApi.markRead(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'notifications'] }),
  });

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const unread = query.data?.unread ?? 0;
  const items = query.data?.items ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-bg-card text-text-secondary hover:bg-hover hover:text-text-primary"
      >
        <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
        {unread ? (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-status-error ring-2 ring-bg-card" />
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] animate-fade-in overflow-hidden rounded-xl border border-line bg-bg-secondary shadow-lg">
          <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
            <p className="text-sm font-semibold">
              Notifications
              {unread ? <span className="ml-2 rounded-full bg-status-error/12 px-1.5 text-xs text-status-error">{unread > 99 ? '99+' : unread}</span> : null}
            </p>
            {unread ? (
              <button type="button" className="text-xs text-accent hover:underline" onClick={() => markRead.mutate(undefined)}>
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-text-muted">You're all caught up.</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.readAt) markRead.mutate([n.id]);
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                    className={`block w-full border-b border-line-subtle px-4 py-3 text-left last:border-0 hover:bg-hover ${
                      n.readAt ? 'opacity-70' : ''
                    }`}
                  >
                    <p className="flex items-start gap-2 text-sm font-medium">
                      {!n.readAt ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
                      <span>{n.title}</span>
                    </p>
                    {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{n.body}</p> : null}
                    <p className="mt-1 text-[11px] text-text-muted">{new Date(n.createdAt).toLocaleString()}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
