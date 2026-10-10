import { useId, type FormEvent, type ReactNode } from 'react';
import { Button, Drawer } from '@cullinos/ui';
import { errorMessage } from '@/lib/errors';

export function FormDrawer({
  open,
  onClose,
  title,
  description,
  onSubmit,
  submitLabel = 'Save',
  loading,
  error,
  submitDisabled,
  width = 'lg',
  children,
  extraFooter,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onSubmit: () => void;
  submitLabel?: string;
  loading?: boolean;
  error?: unknown;
  submitDisabled?: boolean;
  width?: 'md' | 'lg' | 'xl';
  children: ReactNode;
  extraFooter?: ReactNode;
}) {
  const formId = useId();
  const msg = typeof error === 'string' ? error : errorMessage(error);
  function handle(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width={width}
      footer={
        <>
          {extraFooter}
          <Button size="sm" variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form={formId} loading={loading} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handle} className="space-y-4">
        {children}
        {msg ? <p className="rounded-lg bg-status-error/10 px-3 py-2 text-sm text-status-error">{msg}</p> : null}
      </form>
    </Drawer>
  );
}
