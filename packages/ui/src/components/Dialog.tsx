import { useEffect, type ReactNode } from 'react';
import { cn } from '../utils';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'ui-dialog-title' : undefined}
        className={cn(
          'relative z-10 w-full rounded-2xl border border-white/10 bg-bg-secondary shadow-lg',
          'animate-[ui-fade-in_var(--duration-normal)_var(--ease-out)]',
          sizeMap[size],
          className,
        )}
      >
        {(title || description) && (
          <div className="border-b border-white/5 px-5 py-4">
            {title ? (
              <h2 id="ui-dialog-title" className="font-display text-lg font-semibold tracking-tight">
                {title}
              </h2>
            ) : null}
            {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-white/5 px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
