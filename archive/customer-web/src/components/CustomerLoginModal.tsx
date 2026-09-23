import { useEffect, useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { ApiRequestError, customerAuthApi } from '@/lib/api';
import { openMsg91OtpWidget } from '@/lib/msg91-widget';
import { useCustomerAuthStore, CUSTOMER_REMEMBER_KEY } from '@/stores/customerAuth';

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
  const [widgetMode, setWidgetMode] = useState<boolean | null>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const [widgetToken, setWidgetToken] = useState<string | null>(null);
  const [marketingEmailOptIn, setMarketingEmailOptIn] = useState(false);
  const [noticeSummary, setNoticeSummary] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    customerAuthApi
      .getWidgetConfig()
      .then((cfg) => {
        if (cancelled) return;
        const enabled = Boolean(cfg.enabled && cfg.widgetId && cfg.tokenAuth);
        setWidgetMode(enabled);
        setWidgetId(cfg.widgetId);
        setWidgetToken(cfg.tokenAuth);
        if (typeof cfg.noticeSummary === 'string') {
          setNoticeSummary(cfg.noticeSummary);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setWidgetMode(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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
    setMarketingEmailOptIn(false);
    setRemember(true);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function toWidgetIdentifier(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  async function continueWithWidget(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !widgetId || !widgetToken) {
      setError('Store not loaded or OTP widget is not configured');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const widget = await openMsg91OtpWidget({
        config: { widgetId, tokenAuth: widgetToken },
        identifier: toWidgetIdentifier(phone.trim()),
      });
      const res = await customerAuthApi.verifyWidget({
        orgId,
        accessToken: widget.accessToken,
        phone: widget.identifier ?? toWidgetIdentifier(phone.trim()),
        name: name.trim() || undefined,
        marketingEmailOptIn,
      });
      localStorage.setItem(CUSTOMER_REMEMBER_KEY, remember ? 'true' : 'false');
      setAuth({ accessToken: res.accessToken, customer: res.customer });
      reset();
      onSuccess?.();
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'OTP failed';
      setError(message);
    } finally {
      setLoading(false);
    }
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
      if (res.sent === false && !res.debugOtp) {
        setError(
          'SMS could not be sent. Check that phone OTP (MSG91) is configured, or try again.',
        );
        return;
      }
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
        marketingEmailOptIn,
      });
      localStorage.setItem(CUSTOMER_REMEMBER_KEY, remember ? 'true' : 'false');
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

  const usingWidget = widgetMode === true;
  const subtitle =
    step === 'otp'
      ? 'Enter the code sent to your phone.'
      : usingWidget
        ? 'Verify with a one-time code via MSG91.'
        : 'We will text you a one-time code.';

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
          <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
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

      {widgetMode === null ? (
        <p className="text-sm text-text-muted">Loading sign-in…</p>
      ) : step === 'phone' ? (
        <form className="space-y-3" onSubmit={usingWidget ? continueWithWidget : requestOtp}>
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
          <p className="text-xs leading-relaxed text-text-muted">
            {noticeSummary ??
              'Your phone is used to send a one-time login code and to identify your profile for orders and loyalty.'}{' '}
            Marketing messages are optional and require your consent below.
          </p>
          <label className="flex items-start gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={marketingEmailOptIn}
              onChange={(e) => setMarketingEmailOptIn(e.target.checked)}
            />
            <span>Email me occasional offers (optional — you can unsubscribe anytime)</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Keep me signed in</span>
          </label>
          <Button type="submit" className="w-full" loading={loading} disabled={!orgId}>
            {usingWidget ? 'Continue' : 'Send OTP'}
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
