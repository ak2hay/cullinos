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

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
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
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = `toast-${++toastSeq}`;
      setItems((prev) => [...prev, { id, variant, message }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss, durationMs],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message: string) => toast(message, 'success'),
      error: (message: string) => toast(message, 'error'),
    }),
    [toast],
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
            className={cn(
              'pointer-events-auto rounded-lg border px-4 py-3 text-sm font-medium shadow-lg',
              toastStyles[item.variant],
            )}
          >
            {item.message}
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
