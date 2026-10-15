import type { ReactNode } from 'react';
import { cn } from '../utils';

export interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, required, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text-secondary">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-status-error">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? <p className="text-sm text-status-error">{error}</p> : null}
    </div>
  );
}

export const controlClassName =
  'h-11 w-full rounded-lg border border-line bg-bg-card px-3 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20';

export function fieldId(label: string, id?: string): string {
  return id ?? label.toLowerCase().replace(/\s+/g, '-');
}
