import type { ReactNode } from 'react';
import { cn } from '../utils';

export function EmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-4 py-8 text-center text-sm text-text-muted', className)}>
      {children}
    </div>
  );
}
