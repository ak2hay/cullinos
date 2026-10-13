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
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border-light bg-bg-primary/95 px-4 py-2 shadow-soft backdrop-blur-md md:p-5"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 lg:px-4">
        <p className="text-xs leading-snug text-text-secondary md:text-sm">
          Essential cookies only (security) and cookieless analytics.{' '}
          <Link href="/privacy" className="text-brand-gold hover:underline">
            Privacy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2 md:gap-3">
          <button type="button" onClick={() => choose('declined')} className="btn-pill min-h-11 px-4! md:px-7!">
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="btn-pill-filled btn-pill min-h-11 px-4! md:px-7!"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
