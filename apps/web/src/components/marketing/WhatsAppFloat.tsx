'use client';

import { usePathname } from 'next/navigation';
import { WhatsAppIcon } from '@/components/marketing/ContactIcons';
import { BUSINESS_NAP, BUSINESS_WHATSAPP_HREF } from '@/lib/business';

/** Paths where the mobile sticky CTA bar is hidden, so the floating button covers mobile there. */
const NO_STICKY_BAR_PATHS = new Set(['/contact', '/thank-you']);

export function WhatsAppFloat({ cookieBannerOpen }: { cookieBannerOpen?: boolean }) {
  const pathname = usePathname();

  if (cookieBannerOpen) return null;

  const showOnMobile = NO_STICKY_BAR_PATHS.has(pathname);

  return (
    <a
      href={BUSINESS_WHATSAPP_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${BUSINESS_NAP.brand} on WhatsApp`}
      title="Chat on WhatsApp"
      className={`group fixed bottom-6 right-4 z-50 items-center gap-2 rounded-full bg-[#25D366] p-3.5 text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#1ebe5b] hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366] sm:right-6 ${
        showOnMobile ? 'flex' : 'hidden md:flex'
      }`}
    >
      <WhatsAppIcon className="h-7 w-7" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 group-hover:max-w-[8rem] group-hover:pr-1.5 group-hover:opacity-100 group-focus-visible:max-w-[8rem] group-focus-visible:pr-1.5 group-focus-visible:opacity-100">
        Chat with us
      </span>
    </a>
  );
}
