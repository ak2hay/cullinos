'use client';

import { useState } from 'react';

const planOptions = ['Starter', 'Professional', 'Enterprise', 'Hospitality', 'Not sure'];

const inputClass =
  'w-full rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm outline-none transition focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30';

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');
    setError('');

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Something went wrong');
      }

      setStatus('success');
      form.reset();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-status-success/30 bg-bg-card p-8 text-center shadow-card">
        <h3 className="font-serif text-lg font-medium text-status-success">Message sent</h3>
        <p className="mt-2 text-sm text-text-secondary">
          Thanks for reaching out. Our team will get back to you shortly.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-4 text-sm text-brand-gold hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border-light bg-bg-card p-8 shadow-card">
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" name="name" required />
        <Field label="Restaurant / Business" name="business" required />
        <Field label="Email" name="email" type="email" required />
        <Field label="Phone" name="phone" type="tel" />
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
        <textarea id="message" name="message" rows={5} required className={inputClass} />
      </div>

      {status === 'error' && <p className="text-sm text-status-error">{error}</p>}

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
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: number;
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
        className={inputClass}
      />
    </div>
  );
}
