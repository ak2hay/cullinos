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
          <svg
            viewBox="0 0 24 24"
            className={cn('h-3.5 w-3.5 transition-transform duration-200', open ? 'rotate-90' : '')}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      ) : (
        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </p>
      )}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-[var(--ease-out)]',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="min-h-0 space-y-0.5 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
