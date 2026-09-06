'use client';

import { useCallback, useState } from 'react';
import { CookieBanner } from '@/components/marketing/CookieBanner';
import { StickyMobileCta } from '@/components/marketing/StickyMobileCta';

export function MarketingChromeExtras() {
  /** null = consent not read yet (avoid sticky CTA flash over cookie banner) */
  const [cookieBannerOpen, setCookieBannerOpen] = useState<boolean | null>(null);
  const onOpenChange = useCallback((open: boolean) => setCookieBannerOpen(open), []);

  return (
    <>
      <StickyMobileCta cookieBannerOpen={cookieBannerOpen !== false} />
      <CookieBanner onOpenChange={onOpenChange} />
    </>
  );
}

