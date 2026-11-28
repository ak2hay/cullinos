'use client';

import { useCallback, useState } from 'react';
import { PhoneField, Turnstile } from '@cullinos/ui';
import { BUSINESS_NAP } from '@/lib/business';

const inputClass =
  'w-full rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm outline-none transition focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30';

const inputErrorClass =
  'w-full rounded-xl border border-status-error bg-bg-card px-4 py-2.5 text-sm outline-none transition focus:border-status-error focus:ring-1 focus:ring-status-error/30';

const ACCOUNT_TYPES = [
  { value: 'Guest app', label: 'Guest (ordering app)' },
  { value: 'Restaurant staff', label: 'Restaurant staff' },
  { value: 'Restaurant owner', label: 'Restaurant owner' },
] as const;

type FieldErrors = Partial<Record<'name' | 'email' | 'business' | 'details' | 'turnstile', string>>;

export function AccountDeletionForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [turnstileToken, setTurnstileToken] = useState('');
  const [phone, setPhone] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const onToken = useCallback((token: string) => {
    setTurnstileToken(token);
    setFieldErrors((prev) => {
      if (!prev.turnstile) return prev;
      const next = { ...prev };
      delete next.turnstile;
      return next;
    });
  }, []);

  const onExpire = useCallback(() => setTurnstileToken(''), []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');
    setError('');
    setFieldErrors({});

    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const accountType = String(data.get('accountType') ?? 'Guest app');
    const businessInput = String(data.get('business') ?? '').trim();
    const details = String(data.get('details') ?? '').trim();
    const business =
      businessInput || (accountType === 'Guest app' ? 'Guest app account' : '');

    const nextErrors: FieldErrors = {};
    if (!name) nextErrors.name = 'Name is required';
    if (!email) nextErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email';
    if (!business) nextErrors.business = 'Restaurant or organization is required';
    if (!details) nextErrors.details = 'Tell us which account to delete';
    if (turnstileEnabled && !turnstileToken) nextErrors.turnstile = 'Please complete the security check';

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setStatus('error');
      return;
    }

    const message = [
      'Account and data deletion request',
      `Account type: ${accountType}`,
      `Phone: ${phone.trim() || '—'}`,
      '',
      details,
    ].join('\n');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          business,
          email,
          phone,
          plan: 'Account deletion',
          source: 'account-deletion',
          message,
          website: String(data.get('website') ?? ''),
          'cf-turnstile-response': turnstileToken,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Something went wrong');
      }

      setSubmittedEmail(email);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-2xl border border-border-light bg-bg-card p-8 shadow-card">
        <h2 className="font-serif text-2xl font-medium">Request received</h2>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          We saved your deletion request and will email {submittedEmail} to confirm it is you before we delete
          the account. This does not happen instantly. If you do not hear back within a few business days, write
          to{' '}
          <a href={`mailto:${BUSINESS_NAP.email}`} className="text-brand-gold hover:underline">
            {BUSINESS_NAP.email}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border-light bg-bg-card p-8 shadow-card" noValidate>
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />

      <Field label="Full name" name="name" required error={fieldErrors.name} />
      <Field label="Email" name="email" type="email" required error={fieldErrors.email} />
      <PhoneField label="Phone on the account (optional)" value={phone} onChange={setPhone} />

      <div>
        <label htmlFor="accountType" className="mb-1.5 block text-sm font-medium">
          Account type
        </label>
        <select id="accountType" name="accountType" className={inputClass} defaultValue="Guest app">
          {ACCOUNT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <Field
        label="Restaurant or organization"
        name="business"
        error={fieldErrors.business}
        placeholder="Guest app account, if you only use the ordering app"
      />

      <div>
        <label htmlFor="details" className="mb-1.5 block text-sm font-medium">
          What should we delete?
        </label>
        <textarea
          id="details"
          name="details"
          rows={5}
          required
          placeholder="Phone number or email on the account, and whether this is the guest app, a staff login, or the whole restaurant workspace."
          aria-invalid={Boolean(fieldErrors.details)}
          aria-describedby={fieldErrors.details ? 'details-error' : undefined}
          className={fieldErrors.details ? inputErrorClass : inputClass}
        />
        {fieldErrors.details && (
          <p id="details-error" className="mt-1.5 text-sm text-status-error">
            {fieldErrors.details}
          </p>
        )}
      </div>

      {turnstileEnabled && (
        <div>
          <Turnstile
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            onToken={onToken}
            onExpire={onExpire}
          />
          {fieldErrors.turnstile && (
            <p className="mt-1.5 text-sm text-status-error">{fieldErrors.turnstile}</p>
          )}
        </div>
      )}

      {status === 'error' && error && <p className="text-sm text-status-error">{error}</p>}

      <button type="submit" disabled={status === 'loading'} className="btn-pill-filled btn-pill disabled:opacity-60">
        {status === 'loading' ? 'Sending…' : 'Request deletion'}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  error,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className={error ? inputErrorClass : inputClass}
      />
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-sm text-status-error">
          {error}
        </p>
      )}
    </div>
  );
}
