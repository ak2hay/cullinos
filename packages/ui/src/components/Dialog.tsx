import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../use-presence';
import { cn } from '../utils';
import { CloseIcon } from './CloseIcon';

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

  const { mounted, state } = usePresence(open, 160);
  if (!mounted || typeof document === 'undefined') return null;
  const closing = state === 'closing';

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center',
        closing && 'pointer-events-none',
      )}
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className={cn(
          'absolute inset-0 bg-scrim backdrop-blur-[2px]',
          closing
            ? 'animate-[ui-fade-out_160ms_ease_both]'
            : 'animate-[ui-fade-in_var(--duration-normal)_var(--ease-out)_both]',
        )}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'ui-dialog-title' : undefined}
        className={cn(
          'relative z-10 flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-2xl border border-line bg-bg-secondary shadow-lg',
          closing
            ? 'animate-[ui-scale-out_160ms_ease_both]'
            : 'animate-[ui-scale-in_var(--duration-normal)_var(--ease-out)_both]',
          sizeMap[size],
          className,
        )}
      >
        {(title || description) && (
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line-subtle px-5 py-4">
            <div className="min-w-0">
              {title ? (
                <h2 id="ui-dialog-title" className="font-display text-lg font-semibold tracking-tight">
                  {title}
                </h2>
              ) : null}
              {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-hover hover:text-text-primary"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line-subtle px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
