import { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { Button, Dialog } from '@cullinos/ui';
import { Notice } from '@/components/common';
import type { OnboardCredentials } from './OnboardTenantDrawer';

function CopyRow({
  label,
  value,
  display,
  copied,
  onCopy,
  extra,
}: {
  label: string;
  value: string;
  display?: string;
  copied: boolean;
  onCopy: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line-subtle bg-bg-elevated/60 px-3 py-2.5">
      <p className="text-xs text-text-muted">{label}</p>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-sm">{display ?? value}</span>
        {extra}
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-text-secondary hover:bg-hover"
        >
          {copied ? <Check size={14} className="text-status-success" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export function CredentialsDialog({ credentials, onClose }: { credentials: OnboardCredentials | null; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setRevealed(false);
    setCopied(null);
  }, [credentials]);

  async function copy(field: string, value: string, clearAfterMs?: number) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      window.setTimeout(() => setCopied(null), 1500);
      if (clearAfterMs) window.setTimeout(() => void navigator.clipboard.writeText('').catch(() => undefined), clearAfterMs);
    } catch {
      /* clipboard blocked; the value stays visible to copy manually */
    }
  }

  return (
    <Dialog
      open={Boolean(credentials)}
      onClose={onClose}
      title="Restaurant onboarded"
      description="Share these credentials once. The owner must change the password on first login."
      footer={
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      }
    >
      {credentials ? (
        <div className="space-y-3">
          <Notice tone={credentials.emailSent ? 'success' : 'warning'}>
            {credentials.emailSent
              ? 'Credentials were also emailed to the owner.'
              : 'Email was not sent (check RESEND_API_KEY). Copy the credentials below.'}
          </Notice>
          <CopyRow label="Owner email" value={credentials.ownerEmail} copied={copied === 'email'} onCopy={() => copy('email', credentials.ownerEmail)} />
          <CopyRow
            label="Temporary password"
            value={credentials.temporaryPassword}
            display={revealed ? credentials.temporaryPassword : '•'.repeat(Math.max(12, credentials.temporaryPassword.length))}
            copied={copied === 'password'}
            onCopy={() => copy('password', credentials.temporaryPassword, 30_000)}
            extra={
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                aria-label={revealed ? 'Hide password' : 'Reveal password'}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-text-secondary hover:bg-hover"
              >
                {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            }
          />
          <CopyRow label="Admin URL" value={credentials.adminUrl} copied={copied === 'url'} onCopy={() => copy('url', credentials.adminUrl)} />
          <p className="text-xs text-text-muted">The clipboard is cleared 30 seconds after copying the password.</p>
        </div>
      ) : null}
    </Dialog>
  );
}
