import type { InputHTMLAttributes } from 'react';
import { cn } from '../utils';
import { Field, controlClassName, fieldId } from './Field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = fieldId(label, id);
  return (
    <Field label={label} htmlFor={inputId} error={error}>
      <input
        id={inputId}
        className={cn(controlClassName, error && 'border-status-error', className)}
        {...props}
      />
    </Field>
  );
}
