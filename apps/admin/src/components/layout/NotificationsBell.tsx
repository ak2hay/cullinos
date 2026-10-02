import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Bell, ClipboardList, PackageX } from 'lucide-react';
import { useLowStock, useOpenOrders } from '@/lib/useShellAlerts';

/** Header bell: surfaces alerts the portal can already derive (open orders, low stock). */
export function NotificationsBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const openOrders = useOpenOrders();
  const lowStock = useLowStock();

  const alerts = [
    openOrders.total > 0
      ? {
          id: 'open-orders',
          to: '/orders',
          icon: <ClipboardList size={16} />,
          tone: 'bg-status-info/15 text-status-info',
          title: t('shell.alerts.openOrders', {
            count: openOrders.total,
            defaultValue: '{{count}} open orders',
          }),
          body: t('shell.alerts.openOrdersBody', 'In progress or waiting to be served'),
        }
      : null,
    lowStock.items.length > 0
      ? {
          id: 'low-stock',
          to: '/inventory',
          icon: <PackageX size={16} />,
          tone: 'bg-status-warning/15 text-status-warning',
          title: t('shell.alerts.lowStock', {
            count: lowStock.items.length,
            defaultValue: '{{count}} low-stock items',
          }),
          body: lowStock.items
            .slice(0, 3)
            .map((i) => i.name)
            .join(', '),
        }
      : null,
  ].filter((a): a is NonNullable<typeof a> => a !== null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t('shell.notifications', 'Notifications')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line-subtle text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
      >
        <Bell size={18} />
        {alerts.length > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-error opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-error ring-2 ring-bg-secondary" />
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          className="fixed inset-x-3 top-16 z-50 origin-top-right animate-scale-in rounded-xl border border-line bg-bg-card p-2 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80"
        >
          <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {t('shell.notifications', 'Notifications')}
          </p>
          {alerts.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-text-muted">
              {t('shell.alerts.none', "You're all caught up")}
            </p>
          ) : (
            alerts.map((alert) => (
              <Link
                key={alert.id}
                role="menuitem"
                to={alert.to}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-hover"
              >
                <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${alert.tone}`}>
                  {alert.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text-primary">{alert.title}</span>
                  <span className="block truncate text-xs text-text-muted">{alert.body}</span>
                </span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
