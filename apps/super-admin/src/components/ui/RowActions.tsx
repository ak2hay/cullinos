import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { MoreVertical } from 'lucide-react';
import { cn } from '@cullinos/ui';

export type MenuAction = {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
};

/** Closes a popover on outside click or Escape. */
export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export function ActionMenu({
  actions,
  label = 'More actions',
  trigger,
}: {
  actions: MenuAction[];
  label?: string;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const visible = actions.filter((a) => !a.hidden);
  if (!visible.length) return null;
  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-text-secondary hover:bg-hover hover:text-text-primary"
      >
        {trigger ?? <MoreVertical size={16} aria-hidden="true" />}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-44 animate-fade-in rounded-lg border border-line bg-bg-secondary p-1 shadow-lg"
        >
          {visible.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                disabled={a.disabled}
                onClick={() => {
                  setOpen(false);
                  a.onSelect();
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm disabled:opacity-50',
                  a.danger ? 'text-status-error hover:bg-status-error/10' : 'text-text-secondary hover:bg-hover hover:text-text-primary',
                )}
              >
                {Icon ? <Icon size={15} aria-hidden="true" /> : null}
                {a.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function RowActions({
  viewHref,
  onView,
  viewLabel = 'View',
  actions = [],
}: {
  viewHref?: string;
  onView?: () => void;
  viewLabel?: string;
  actions?: MenuAction[];
}) {
  const btn =
    'inline-flex h-8 items-center rounded-lg border border-line px-3 text-sm font-medium text-text-primary hover:bg-hover';
  return (
    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      {viewHref ? (
        <Link to={viewHref} className={btn}>
          {viewLabel}
        </Link>
      ) : onView ? (
        <button type="button" onClick={onView} className={btn}>
          {viewLabel}
        </button>
      ) : null}
      <ActionMenu actions={actions} />
    </div>
  );
}
