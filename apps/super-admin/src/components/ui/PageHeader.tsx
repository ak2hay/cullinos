import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@cullinos/ui';
import { findNavLeaf } from '@/components/layout/nav';

export type Crumb = { label: string; to?: string };

function useNavCrumbs(title: string): Crumb[] {
  const { pathname } = useLocation();
  const hit = findNavLeaf(pathname);
  if (!hit) return [];
  const crumbs: Crumb[] = [{ label: hit.section }];
  if (pathname !== hit.leaf.to) {
    crumbs.push({ label: hit.leaf.label, to: hit.leaf.to });
    crumbs.push({ label: title });
  } else if (hit.section !== hit.leaf.label) {
    crumbs.push({ label: hit.leaf.label });
  }
  return crumbs;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn('flex flex-wrap items-center gap-1 text-xs', className)}>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1">
            {c.to && !last ? (
              <Link to={c.to} className="text-text-muted hover:text-text-primary">
                {c.label}
              </Link>
            ) : (
              <span className={last ? 'font-medium text-text-primary' : 'text-text-muted'} aria-current={last ? 'page' : undefined}>
                {c.label}
              </span>
            )}
            {!last ? <ChevronRight size={12} className="text-text-muted" aria-hidden="true" /> : null}
          </span>
        );
      })}
    </nav>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Explicit crumbs; `false` hides them; default derives from the nav. */
  breadcrumbs?: Crumb[] | false;
  /** Leading visual (e.g. an entity avatar on detail pages). */
  leading?: ReactNode;
  /** Inline badges next to the title. */
  meta?: ReactNode;
}

export function PageHeader({ title, description, actions, className, breadcrumbs, leading, meta }: PageHeaderProps) {
  const derived = useNavCrumbs(typeof title === 'string' ? title : 'Details');
  const crumbs = breadcrumbs === false ? [] : (breadcrumbs ?? derived);
  return (
    <div className={cn('space-y-2', className)}>
      <Breadcrumbs items={crumbs} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {leading}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
              {meta}
            </div>
            {description ? <p className="mt-1 max-w-3xl text-sm text-text-secondary">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
