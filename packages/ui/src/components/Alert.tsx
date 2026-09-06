import type { ReactNode } from 'react';
import { cn } from '../utils';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export interface AlertProps {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
}

const variants: Record<AlertVariant, string> = {
  success: 'border-status-success/30 bg-status-success/10 text-status-success',
  error: 'border-status-error/30 bg-status-error/10 text-status-error',
  warning: 'border-status-warning/30 bg-status-warning/10 text-status-warning',
  info: 'border-status-info/30 bg-status-info/10 text-status-info',
};

export function Alert({ variant = 'info', children, className }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn('rounded-xl border px-4 py-3 text-sm', variants[variant], className)}
    >
      {children}
    </div>
  );
}

export function ErrorBanner({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Alert variant="error" className={className}>
      {children}
    </Alert>
  );
}
