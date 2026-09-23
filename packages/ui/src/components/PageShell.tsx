import type { ReactNode } from 'react';
import { cn } from '../utils';
import { PageHeader, type PageHeaderProps } from './PageHeader';

export interface PageShellProps extends PageHeaderProps {
  children?: ReactNode;
  filters?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PageShell({
  title,
  description,
  actions,
  filters,
  children,
  className,
  contentClassName,
}: PageShellProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <PageHeader title={title} description={description} actions={actions} />
      {filters ? <div className="flex flex-wrap items-center gap-3">{filters}</div> : null}
      <div className={cn('space-y-6', contentClassName)}>{children}</div>
    </div>
  );
}
