'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const CONSENT_KEY = 'cullinos-cookie-consent';

export type CookieConsent = 'accepted' | 'declined';

export function getCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(CONSENT_KEY);
  return value === 'accepted' || value === 'declined' ? value : null;
}

export function CookieBanner({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const existing = getCookieConsent();
    const shouldOpen = !existing;
    setOpen(shouldOpen);
    onOpenChange?.(shouldOpen);
  }, [onOpenChange]);

  function choose(value: CookieConsent) {
    localStorage.setItem(CONSENT_KEY, value);
    setOpen(false);
    onOpenChange?.(false);
    window.dispatchEvent(new Event('cullinos-cookie-consent'));
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border-light bg-bg-primary/95 p-4 shadow-soft backdrop-blur-md md:p-5"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:px-4">
        <p className="text-sm leading-relaxed text-text-secondary">
          We use essential cookies for security (Cloudflare Turnstile on forms) and cookieless analytics.
          See our{' '}
          <Link href="/privacy" className="text-brand-gold hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-3">
          <button type="button" onClick={() => choose('declined')} className="btn-pill text-sm">
            Decline
          </button>
          <button type="button" onClick={() => choose('accepted')} className="btn-pill-filled btn-pill text-sm">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
