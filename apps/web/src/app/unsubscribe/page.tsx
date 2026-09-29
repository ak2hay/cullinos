'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:3000/api/v1';

type Channel = 'email' | 'sms';

async function unsubscribe(token: string, channel: Channel) {
  const res = await fetch(`${API_BASE}/public/privacy/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, channel }),
  });
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) throw new Error(body.message || 'Unsubscribe failed.');
  return body.message || 'You have been unsubscribed.';
}

function UnsubscribeInner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [smsStatus, setSmsStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  // The opt-out runs from the page (a POST), never from the link itself, so mail
  // scanners that prefetch the URL can't unsubscribe anyone.
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing unsubscribe token.');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    unsubscribe(token, 'email')
      .then((msg) => {
        if (cancelled) return;
        setStatus('ok');
        setMessage(msg);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Could not reach the unsubscribe service.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function stopSms() {
    setSmsStatus('loading');
    try {
      setMessage(await unsubscribe(token, 'sms'));
      setSmsStatus('done');
    } catch (err) {
      setSmsStatus('idle');
      setMessage(err instanceof Error ? err.message : 'Could not update SMS preferences.');
    }
  }

  return (
    <Section title="">
      <div className="mx-auto max-w-xl text-center">
        {status === 'loading' || status === 'idle' ? (
          <p className="text-text-secondary">Updating your preferences…</p>
        ) : (
          <p className={status === 'ok' ? 'text-text-primary' : 'text-status-error'}>{message}</p>
        )}
        {status === 'ok' && smsStatus !== 'done' ? (
          <button
            type="button"
            onClick={stopSms}
            disabled={smsStatus === 'loading'}
            className="mt-6 text-sm text-brand-gold hover:underline disabled:opacity-60"
          >
            {smsStatus === 'loading' ? 'Updating…' : 'Also stop promotional SMS'}
          </button>
        ) : null}
        <p className="mt-6 text-sm text-text-secondary">
          <Link href="/privacy" className="text-brand-gold hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </Section>
  );
}

export default function UnsubscribePage() {
  return (
    <>
      <Hero
        eyebrow="Privacy"
        title="Unsubscribe"
        subtitle="Withdraw consent for promotional messages from Cullinos tenants."
        primaryCta={{ label: 'Privacy Policy', href: '/privacy' }}
        secondaryCta={null}
      />
      <Suspense fallback={<Section title=""><p className="text-center text-text-secondary">Loading…</p></Section>}>
        <UnsubscribeInner />
      </Suspense>
    </>
  );
}
