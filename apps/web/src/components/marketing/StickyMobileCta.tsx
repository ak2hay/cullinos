'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TRIAL_CTA_LABEL } from '@cullinos/shared';
import { TrialTerms } from '@/components/marketing/TrialTerms';
import { WhatsAppIcon } from '@/components/marketing/ContactIcons';
import { useMarketingCms } from '@/components/marketing/MarketingCmsProvider';
import { BUSINESS_WHATSAPP_HREF } from '@/lib/business';
import { getRegisterUrl } from '@/lib/urls';

const HIDDEN_PATHS = new Set(['/contact', '/thank-you']);

export function StickyMobileCta({ cookieBannerOpen }: { cookieBannerOpen?: boolean }) {
  const pathname = usePathname();
  const cms = useMarketingCms();
  const registerUrl = cms.site?.registerUrl || getRegisterUrl();

  if (cookieBannerOpen || HIDDEN_PATHS.has(pathname)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border-light bg-bg-primary/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
      <div className="mx-auto max-w-lg">
        <TrialTerms className="mb-1 text-center" />
        <div className="flex items-center gap-2">
          <Link href={registerUrl} className="btn-pill-filled btn-pill flex-1 justify-center text-center text-sm">
            {TRIAL_CTA_LABEL}
          </Link>
          <Link href="/contact" className="btn-pill flex-1 justify-center text-center text-sm">
            Contact
          </Link>
          <a
            href={BUSINESS_WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with us on WhatsApp"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
          >
            <WhatsAppIcon className="h-6 w-6" />
          </a>
        </div>
      </div>
    </div>
  );
}
