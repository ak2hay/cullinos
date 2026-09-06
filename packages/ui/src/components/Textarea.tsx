import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../utils';
import { Field, fieldId } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export function Textarea({ label, error, id, className = '', ...props }: TextareaProps) {
  const textareaId = fieldId(label, id);
  return (
    <Field label={label} htmlFor={textareaId} error={error}>
      <textarea
        id={textareaId}
        className={cn(
          'min-h-24 w-full rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20',
          error && 'border-status-error',
          className,
        )}
        {...props}
      />
    </Field>
  );
}
