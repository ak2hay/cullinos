import { useCallback, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Headset, Store } from 'lucide-react';
import { Button, Input, PasswordInput, Turnstile, ThemeToggle, cn, isTurnstileEnabled } from '@cullinos/ui';
import { Notice } from '@/components/common';
import { login, resendOtp, verifyOtp } from '@/lib/auth';
import { useSession, type SessionMode } from '@/stores/session';

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || '';

const MODES: Array<{ id: SessionMode; label: string; hint: string; icon: typeof Store }> = [
  { id: 'customer', label: 'Restaurant', hint: 'Owners and staff of a Cullinos restaurant', icon: Store },
  { id: 'agent', label: 'Rkyves staff', hint: 'Support agents and platform team', icon: Headset },
];

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useSession();
  const [mode, setMode] = useState<SessionMode>(params.get('as') === 'agent' ? 'agent' : 'customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileOn = isTurnstileEnabled(TURNSTILE_SITE_KEY);
  const onCaptchaToken = useCallback((t: string) => setCaptchaToken(t), []);
  const onCaptchaExpire = useCallback(() => setCaptchaToken(''), []);

  if (session.accessToken && session.mode) {
    return <Navigate to={session.mode === 'agent' ? '/agent' : '/'} replace />;
  }

  function goNext(m: SessionMode) {
    const next = params.get('next');
    const fits = next && (m === 'agent' ? next.startsWith('/agent') : !next.startsWith('/agent'));
    navigate(fits ? next : m === 'agent' ? '/agent' : '/', { replace: true });
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (turnstileOn && !captchaToken) return setError('Please complete the security check');
    setLoading(true);
    try {
      const res = await login(mode, { email, password, captchaToken: captchaToken || undefined });
      if (res) setChallenge(res.challengeToken);
      else goNext(mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setCaptchaToken('');
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(mode, { challengeToken: challenge, otp });
      goNext(mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!challenge) return;
    setError(null);
    setLoading(true);
    try {
      const res = await resendOtp(mode, challenge);
      setChallenge(res.challengeToken);
      setInfo('A new code has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Headset size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-base font-semibold leading-tight">Cullinos Support</p>
            <p className="text-xs text-text-muted">by Rkyves</p>
          </div>
        </div>
        <ThemeToggle variant="icon" />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-line-subtle bg-bg-card p-6 shadow-sm">
          <h1 className="font-display text-xl font-semibold">{challenge ? 'Check your email' : 'Sign in to support'}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {challenge ? 'Enter the 6-digit code we sent you.' : 'Raise and track tickets, or work the support queue.'}
          </p>

          {!challenge ? (
            <div className="mt-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition',
                    mode === m.id ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-line hover:border-line-strong',
                  )}
                >
                  <m.icon size={18} className="text-accent" aria-hidden="true" />
                  <span className="mt-1.5 block text-sm font-semibold">{m.label}</span>
                  <span className="block text-xs text-text-muted">{m.hint}</span>
                </button>
              ))}
            </div>
          ) : null}

          {challenge ? (
            <form onSubmit={submitOtp} className="mt-5 space-y-4">
              <Input
                label="Verification code"
                inputMode="numeric"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              {error ? <Notice tone="error">{error}</Notice> : null}
              {info ? <Notice>{info}</Notice> : null}
              <Button type="submit" loading={loading} className="w-full">
                Verify and sign in
              </Button>
              <div className="flex justify-between">
                <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={resend}>
                  Resend code
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setChallenge(null);
                    setOtp('');
                    setError(null);
                  }}
                >
                  Back
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitPassword} className="mt-5 space-y-4">
              <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <PasswordInput label="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              {turnstileOn ? <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={onCaptchaToken} onExpire={onCaptchaExpire} /> : null}
              {error ? <Notice tone="error">{error}</Notice> : null}
              <Button type="submit" loading={loading} className="w-full">
                Sign in as {mode === 'agent' ? 'Rkyves staff' : 'restaurant'}
              </Button>
              <p className="text-center text-xs text-text-muted">
                {mode === 'agent' ? 'Use your platform (super admin) login.' : 'Use the same email and password as your Cullinos admin login.'}
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
