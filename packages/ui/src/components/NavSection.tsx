import type { ReactNode } from 'react';
import { cn } from '../utils';

export interface NavSectionItem {
  to: string;
  label: string;
  end?: boolean;
  icon?: ReactNode;
}

export interface NavSectionDef {
  id: string;
  label: string;
  items: NavSectionItem[];
}

export function NavSection({
  label,
  children,
  collapsible,
  open = true,
  onToggle,
}: {
  label: string;
  children: ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="space-y-1">
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between rounded-lg px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary"
        >
          <span>{label}</span>
          <span className={cn('transition-transform', open ? 'rotate-90' : '')} aria-hidden>
            ›
          </span>
        </button>
      ) : (
        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </p>
      )}
      {open ? children : null}
    </div>
  );
}
