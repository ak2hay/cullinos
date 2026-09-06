import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'warning';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-primary text-bg-primary hover:bg-brand-primary-dark disabled:opacity-60',
  secondary:
    'bg-bg-elevated text-text-primary border border-white/10 hover:bg-bg-card disabled:opacity-60',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-white/5 disabled:opacity-60',
  success: 'bg-status-ready text-bg-primary hover:opacity-90 disabled:opacity-60',
  warning: 'bg-status-preparing text-bg-primary hover:opacity-90 disabled:opacity-60',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-14 px-5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}
