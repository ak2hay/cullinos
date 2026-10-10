import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@cullinos/ui';

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-elevated text-text-muted">
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-medium text-text-primary">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
