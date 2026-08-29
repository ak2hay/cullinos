'use client';

import { useState } from 'react';

const planOptions = ['Starter', 'Professional', 'Enterprise', 'Hospitality', 'Not sure'];

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
      <div className="rounded-xl border border-status-success/30 bg-status-success/10 p-8 text-center">
        <h3 className="text-lg font-semibold text-status-success">Message sent</h3>
        <p className="mt-2 text-sm text-text-secondary">
          Thanks for reaching out. Our team will get back to you shortly.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-4 text-sm text-brand-primary hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
        <select
          id="plan"
          name="plan"
          className="w-full rounded-lg border border-white/10 bg-bg-secondary px-4 py-2.5 text-sm outline-none focus:border-brand-primary"
        >
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
          className="w-full rounded-lg border border-white/10 bg-bg-secondary px-4 py-2.5 text-sm outline-none focus:border-brand-primary"
        />
      </div>

      {status === 'error' && <p className="text-sm text-status-error">{error}</p>}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="rounded-lg bg-brand-primary px-6 py-3 text-sm font-medium text-bg-primary transition hover:bg-brand-primary-dark disabled:opacity-60"
      >
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
        className="w-full rounded-lg border border-white/10 bg-bg-secondary px-4 py-2.5 text-sm outline-none focus:border-brand-primary"
      />
    </div>
  );
}
