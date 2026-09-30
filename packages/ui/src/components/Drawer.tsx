import { useEffect, type ReactNode } from 'react';
import { usePresence } from '../use-presence';
import { cn } from '../utils';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  side?: 'right' | 'left';
  width?: 'md' | 'lg' | 'xl';
}

const widthMap = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
} as const;

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  side = 'right',
  width = 'lg',
}: DrawerProps) {
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

  const { mounted, state } = usePresence(open, 220);
  if (!mounted) return null;
  const closing = state === 'closing';
  const slide =
    side === 'right'
      ? closing
        ? 'animate-[ui-slide-out-right_220ms_ease-in_both]'
        : 'animate-slide-in-right'
      : closing
        ? 'animate-[ui-slide-out-left_220ms_ease-in_both]'
        : 'animate-slide-in-left';

  return (
    <div className={cn('fixed inset-0 z-50', closing && 'pointer-events-none')} role="presentation">
      <button
        type="button"
        aria-label="Close drawer"
        className={cn(
          'absolute inset-0 bg-scrim backdrop-blur-[2px]',
          closing ? 'animate-[ui-fade-out_220ms_ease_both]' : 'animate-fade-in',
        )}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'ui-drawer-title' : undefined}
        className={cn(
          'absolute top-0 flex h-full w-full flex-col border-line bg-bg-secondary shadow-lg',
          widthMap[width],
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          slide,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line-subtle px-5 py-4">
          <div className="min-w-0">
            {title ? (
              <h2 id="ui-drawer-title" className="font-display text-lg font-semibold tracking-tight">
                {title}
              </h2>
            ) : null}
            {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-2.5 py-1.5 text-sm text-text-secondary hover:text-text-primary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line-subtle px-5 py-4">{footer}</div>
        ) : null}
      </aside>
    </div>
  );
}
