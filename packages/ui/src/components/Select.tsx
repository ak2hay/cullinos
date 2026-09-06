import type { SelectHTMLAttributes } from 'react';
import { cn } from '../utils';
import { Field, controlClassName, fieldId } from './Field';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
}

export function Select({
  label,
  options,
  error,
  id,
  className = '',
  children,
  ...props
}: SelectProps) {
  const selectId = fieldId(label, id);
  return (
    <Field label={label} htmlFor={selectId} error={error}>
      <select
        id={selectId}
        className={cn(controlClassName, error && 'border-status-error', className)}
        {...props}
      >
        {children ??
          options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
      </select>
    </Field>
  );
}
