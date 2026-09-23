'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { getCookieConsent, type CookieConsent } from '@/components/marketing/CookieBanner';

/** Cloudflare Web Analytics — only loaded after cookie consent is accepted. */
export function CloudflareAnalytics() {
  const token = process.env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN;
  const [consent, setConsent] = useState<CookieConsent | null>(null);

  useEffect(() => {
    const refresh = () => setConsent(getCookieConsent());
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cullinos-cookie-consent') refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('cullinos-cookie-consent', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('cullinos-cookie-consent', refresh);
    };
  }, []);

  if (!token || consent !== 'accepted') return null;

  return (
    <Script
      id="cf-web-analytics"
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
      strategy="afterInteractive"
    />
  );
}
