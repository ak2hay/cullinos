import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
}

/**
 * Promise-based replacement for `window.confirm`. Render the returned element
 * once in the component tree.
 */
export function useConfirm(): [(opts: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOpts(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  };

  const element = (
    <ConfirmDialog
      open={opts != null}
      onClose={() => settle(false)}
      onConfirm={() => settle(true)}
      title={opts?.title ?? ''}
      description={opts?.description}
      confirmLabel={opts?.confirmLabel ?? 'Confirm'}
      tone={opts?.tone ?? 'danger'}
    />
  );

  return [confirm, element];
}
