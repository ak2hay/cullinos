'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneField, Turnstile } from '@cullinos/ui';

const planOptions = ['Starter', 'Professional', 'Enterprise', 'Hospitality', 'Not sure'];

const inputClass =
  'w-full rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm outline-none transition focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30';

const inputErrorClass =
  'w-full rounded-xl border border-status-error bg-bg-card px-4 py-2.5 text-sm outline-none transition focus:border-status-error focus:ring-1 focus:ring-status-error/30';

type FieldErrors = Partial<Record<'name' | 'business' | 'email' | 'message' | 'turnstile', string>>;

export function ContactForm() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [turnstileToken, setTurnstileToken] = useState('');
  const [phone, setPhone] = useState('');
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
    const business = String(data.get('business') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();

    const nextErrors: FieldErrors = {};
    if (!name) nextErrors.name = 'Name is required';
    if (!business) nextErrors.business = 'Business name is required';
    if (!email) nextErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email';
    if (!message) nextErrors.message = 'Message is required';
    if (turnstileEnabled && !turnstileToken) nextErrors.turnstile = 'Please complete the security check';

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setStatus('error');
      return;
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...Object.fromEntries(data.entries()),
          phone,
          'cf-turnstile-response': turnstileToken,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Something went wrong');
      }

      router.push('/thank-you');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border-light bg-bg-card p-8 shadow-card" noValidate>
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" name="name" required error={fieldErrors.name} />
        <Field label="Restaurant / Business" name="business" required error={fieldErrors.business} />
        <Field label="Email" name="email" type="email" required error={fieldErrors.email} />
        <PhoneField label="Phone" value={phone} onChange={setPhone} />
        <Field label="City" name="city" />
        <Field label="Number of outlets" name="outlets" type="number" min={1} />
      </div>

      <div>
        <label htmlFor="plan" className="mb-1.5 block text-sm font-medium">
          Plan interest
        </label>
        <select id="plan" name="plan" className={inputClass}>
          {planOptions.map((plan) => (
            <option key={plan} value={plan}>
              {plan}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          aria-invalid={Boolean(fieldErrors.message)}
          aria-describedby={fieldErrors.message ? 'message-error' : undefined}
          className={fieldErrors.message ? inputErrorClass : inputClass}
        />
        {fieldErrors.message && (
          <p id="message-error" className="mt-1.5 text-sm text-status-error">
            {fieldErrors.message}
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
        {status === 'loading' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  min,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: number;
  error?: string;
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
        min={min}
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
