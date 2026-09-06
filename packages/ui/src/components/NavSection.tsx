import type { ReactNode } from 'react';

export interface NavSectionItem {
  to: string;
  label: string;
  end?: boolean;
}

export interface NavSectionDef {
  id: string;
  label: string;
  items: NavSectionItem[];
}

export function NavSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}
