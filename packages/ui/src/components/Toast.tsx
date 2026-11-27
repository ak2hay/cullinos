import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../utils';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastShowOptions {
  variant?: ToastVariant;
  action?: ToastAction;
  /** How long the toast stays. Undo toasts stay longer so the button can be pressed. */
  durationMs?: number;
}

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  leaving?: boolean;
  action?: ToastAction;
}

const TOAST_EXIT_MS = 200;

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  /** Toast with an optional action, such as Undo. */
  show: (message: string, options?: ToastShowOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<ToastVariant, string> = {
  success: 'bg-status-success/15 text-status-success border-status-success/30',
  error: 'bg-status-error/15 text-status-error border-status-error/30',
  warning: 'bg-status-warning/15 text-status-warning border-status-warning/30',
  info: 'bg-status-info/15 text-status-info border-status-info/30',
};

let toastSeq = 0;

export function ToastProvider({
  children,
  durationMs = 4000,
}: {
  children: ReactNode;
  durationMs?: number;
}) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_EXIT_MS);
  }, []);

  const show = useCallback(
    (message: string, options?: ToastShowOptions) => {
      const id = `toast-${++toastSeq}`;
      const variant = options?.variant ?? 'info';
      const action = options?.action;
      setItems((prev) => [...prev, { id, variant, message, action }]);
      const stay = options?.durationMs ?? (action ? 8000 : durationMs);
      if (stay > 0) window.setTimeout(() => dismiss(id), stay);
    },
    [dismiss, durationMs],
  );

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      show(message, { variant });
    },
    [show],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message: string) => show(message, { variant: 'success' }),
      error: (message: string) => show(message, { variant: 'error' }),
      show,
    }),
    [toast, show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            onClick={() => dismiss(item.id)}
            className={cn(
              'pointer-events-auto flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md',
              toastStyles[item.variant],
              item.leaving
                ? 'animate-[ui-toast-out_200ms_ease-in_both]'
                : 'animate-[ui-toast-in_260ms_var(--ease-out)_both]',
            )}
          >
            <span>{item.message}</span>
            {item.action ? (
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-md px-2 font-semibold underline underline-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  item.action?.onClick();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
