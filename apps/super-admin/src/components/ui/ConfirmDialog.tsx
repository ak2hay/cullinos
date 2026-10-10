import { useEffect, useState, type ReactNode } from 'react';
import { Button, Dialog } from '@cullinos/ui';
import { errorMessage } from '@/lib/errors';

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'primary',
  loading,
  error,
  requireText,
  confirmDisabled,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  error?: unknown;
  /** User must type this exact text before confirming. */
  requireText?: string;
  confirmDisabled?: boolean;
  children?: ReactNode;
}) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const blocked = Boolean(confirmDisabled) || (requireText != null && typed.trim() !== requireText);
  const msg = errorMessage(error);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant={tone} loading={loading} disabled={blocked} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {children}
        {requireText != null ? (
          <label className="block text-sm">
            <span className="text-text-secondary">
              Type <span className="font-mono font-semibold text-text-primary">{requireText}</span> to confirm
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-lg border border-line bg-bg-card px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
        ) : null}
        {msg ? <p className="text-sm text-status-error">{msg}</p> : null}
      </div>
    </Dialog>
  );
}
