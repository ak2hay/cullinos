'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMarketingCms } from '@/components/marketing/MarketingCmsProvider';
import { getRegisterUrl } from '@/lib/urls';

const HIDDEN_PATHS = new Set(['/contact', '/thank-you']);

export function StickyMobileCta({ cookieBannerOpen }: { cookieBannerOpen?: boolean }) {
  const pathname = usePathname();
  const cms = useMarketingCms();
  const registerUrl = cms.site?.registerUrl || getRegisterUrl();

  if (cookieBannerOpen || HIDDEN_PATHS.has(pathname)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border-light bg-bg-primary/95 p-3 backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-lg gap-2">
        <Link href={registerUrl} className="btn-pill-filled btn-pill flex-1 justify-center text-center text-sm">
          Start free trial
        </Link>
        <Link href="/contact" className="btn-pill flex-1 justify-center text-center text-sm">
          Contact
        </Link>
      </div>
    </div>
  );
}
