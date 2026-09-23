import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button, Input, PhoneField, Turnstile, isTurnstileEnabled } from '@cullinos/ui';
import { authApi } from '@/lib/api';
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';

export function RegisterPage() {
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const turnstileOn = isTurnstileEnabled(TURNSTILE_SITE_KEY);

  const onCaptchaToken = useCallback((token: string) => setCaptchaToken(token), []);
  const onCaptchaExpire = useCallback(() => setCaptchaToken(''), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (turnstileOn && !captchaToken) {
      setError('Please complete the security check');
      return;
    }
    setLoading(true);
    try {
      const result = await authApi.registerOwner({
        companyName,
        ownerName,
        ownerEmail,
        ownerPhone: ownerPhone || undefined,
        captchaToken: captchaToken || undefined,
      });
      setSuccess(result.message);
      setCompanyName('');
      setOwnerName('');
      setOwnerEmail('');
      setOwnerPhone('');
      setCaptchaToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setCaptchaToken('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Start your free trial"
      subtitle="15 days of Enterprise features. Credentials are emailed (and SMS’d when a phone is provided)."
    >
      {success ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
            {success}
          </div>
          <Link to="/login" className="text-sm font-medium text-brand-primary hover:underline">
            Go to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
              {error}
            </div>
          ) : null}
          <Input
            label="Restaurant name"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <Input
            label="Your name"
            required
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
          <Input
            label="Work email"
            type="email"
            required
            autoComplete="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
          />
          <PhoneField
            label="Mobile (for SMS credentials)"
            value={ownerPhone}
            onChange={setOwnerPhone}
          />
          {turnstileOn ? (
            <Turnstile
              siteKey={TURNSTILE_SITE_KEY}
              onToken={onCaptchaToken}
              onExpire={onCaptchaExpire}
            />
          ) : null}
          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
          <p className="text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
