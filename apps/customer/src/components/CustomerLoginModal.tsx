import { useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { ApiRequestError, customerAuthApi } from '@/lib/api';
import { useCustomerAuthStore } from '@/stores/customerAuth';

interface CustomerLoginModalProps {
  open: boolean;
  orgId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  /** When true, render inline (no overlay) for checkout embed */
  inline?: boolean;
}

export function CustomerLoginModal({
  open,
  orgId,
  onClose,
  onSuccess,
  title = 'Sign in with phone',
  inline = false,
}: CustomerLoginModalProps) {
  const setAuth = useCustomerAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  function reset() {
    setStep('phone');
    setPhone('');
    setName('');
    setCode('');
    setChallengeToken('');
    setDebugOtp(null);
    setError('');
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) {
      setError('Store not loaded');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await customerAuthApi.requestOtp({ phone: phone.trim(), orgId });
      setChallengeToken(res.challengeToken);
      setDebugOtp(res.debugOtp ?? null);
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await customerAuthApi.verifyOtp({
        challengeToken,
        code: code.trim(),
        name: name.trim() || undefined,
      });
      setAuth({ accessToken: res.accessToken, customer: res.customer });
      reset();
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <div
      className={
        inline
          ? 'rounded-xl border border-white/10 bg-bg-card p-4'
          : 'w-full max-w-sm rounded-2xl border border-white/10 bg-bg-secondary p-5 shadow-xl'
      }
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {step === 'phone'
              ? 'We will text you a one-time code.'
              : 'Enter the code sent to your phone.'}
          </p>
        </div>
        {!inline ? (
          <button
            type="button"
            onClick={handleClose}
            className="text-text-muted hover:text-text-primary"
            aria-label="Close"
          >
            ✕
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
          {error}
        </div>
      ) : null}

      {step === 'phone' ? (
        <form className="space-y-3" onSubmit={requestOtp}>
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile"
            required
            autoComplete="tel"
          />
          <Input
            label="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
          <Button type="submit" className="w-full" loading={loading} disabled={!orgId}>
            Send OTP
          </Button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={verifyOtp}>
          <Input
            label="OTP code"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            required
            autoComplete="one-time-code"
          />
          {debugOtp ? (
            <p className="rounded-lg bg-bg-elevated px-3 py-2 text-xs text-text-muted">
              Dev OTP: <span className="font-mono text-brand-primary">{debugOtp}</span>
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError('');
              }}
            >
              Back
            </Button>
            <Button type="submit" className="flex-1" loading={loading}>
              Verify
            </Button>
          </div>
        </form>
      )}
    </div>
  );

  if (inline) return form;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss"
        onClick={handleClose}
      />
      <div className="relative z-10 w-full max-w-sm">{form}</div>
    </div>
  );
}
