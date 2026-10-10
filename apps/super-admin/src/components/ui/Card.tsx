import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@cullinos/ui';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border border-line-subtle bg-bg-card shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Drop body padding (tables, lists that run edge to edge). */
  flush?: boolean;
}) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <Card className={className}>
      {hasHeader ? (
        <div
          className={cn(
            'flex flex-wrap items-start justify-between gap-3 px-5 pt-5',
            flush ? 'border-b border-line-subtle pb-4' : 'pb-0',
          )}
        >
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold tracking-tight">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(flush ? '' : hasHeader ? 'p-5 pt-4' : 'p-5', bodyClassName)}>{children}</div>
    </Card>
  );
}
