'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:3000/api/v1';

function UnsubscribeInner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing unsubscribe token.');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    fetch(`${API_BASE}/public/privacy/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        if (cancelled) return;
        if (!res.ok) {
          setStatus('error');
          setMessage(body.message || 'Unsubscribe failed.');
          return;
        }
        setStatus('ok');
        setMessage(body.message || 'You have been unsubscribed.');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
        setMessage('Could not reach the unsubscribe service.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <Section title="">
      <div className="mx-auto max-w-xl text-center">
        {status === 'loading' || status === 'idle' ? (
          <p className="text-text-secondary">Updating your preferences…</p>
        ) : (
          <p className={status === 'ok' ? 'text-text-primary' : 'text-status-error'}>{message}</p>
        )}
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
        subtitle="Withdraw consent for promotional emails from Cullinos tenants."
        primaryCta={{ label: 'Privacy Policy', href: '/privacy' }}
        secondaryCta={null}
      />
      <Suspense fallback={<Section title=""><p className="text-center text-text-secondary">Loading…</p></Section>}>
        <UnsubscribeInner />
      </Suspense>
    </>
  );
}
