'use client';

import Link from 'next/link';
import { CULLINOS_BRAND } from '@cullinos/shared';
import { useMemo, useState } from 'react';
import { MailIcon, PhoneIcon, WhatsAppIcon } from '@/components/marketing/ContactIcons';
import { useMarketingCms } from '@/components/marketing/MarketingCmsProvider';
import {
  BUSINESS_ADDRESS_LINE,
  BUSINESS_NAP,
  BUSINESS_TEL_HREF,
  BUSINESS_WHATSAPP_HREF,
  MAPS_EMBED_QUERY,
  resolvePublicEmail,
} from '@/lib/business';

const fallbackColumns = [
  {
    title: 'Product',
    groupKey: 'product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/integrations', label: 'Integrations' },
      { href: '/blog', label: 'Blog' },
      { href: '/restaurant-billing-software-mumbai', label: 'Billing software Mumbai' },
      { href: '/cloud-kitchen-pos', label: 'Cloud kitchen POS' },
      { href: '/kot-software', label: 'KOT software' },
    ],
  },
  {
    title: 'Solutions',
    groupKey: 'solutions',
    links: [
      { href: '/solutions/restaurants', label: 'Restaurants' },
      { href: '/solutions/chains', label: 'Chains' },
      { href: '/solutions/hospitality', label: 'Hotels' },
    ],
  },
  {
    title: 'Contact',
    groupKey: 'contact',
    links: [
      { href: '/contact', label: 'Get in touch' },
      { href: '/faq', label: 'FAQ' },
      { href: '/about', label: 'About us' },
      { href: BUSINESS_TEL_HREF, label: `Call ${BUSINESS_NAP.telephone}` },
      { href: BUSINESS_WHATSAPP_HREF, label: `WhatsApp ${BUSINESS_NAP.whatsapp}` },
      { href: `mailto:${BUSINESS_NAP.email}`, label: BUSINESS_NAP.email },
    ],
  },
];

const guideLinks = [
  { href: '/restaurant-billing-software-mumbai', label: 'Restaurant billing software Mumbai' },
  { href: '/cloud-kitchen-pos', label: 'Cloud kitchen POS' },
  { href: '/kot-software', label: 'KOT software' },
];

const socialLinks = [{ label: 'Instagram', href: 'https://www.instagram.com/cullinos/', icon: 'ig' }];

const socialIconClass =
  'flex h-10 w-10 items-center justify-center rounded-full border border-border-light bg-bg-card text-[10px] font-semibold uppercase text-text-secondary transition hover:border-brand-gold hover:bg-brand-gold hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold';

export function MarketingFooter() {
  const cms = useMarketingCms();
  const contactEmail = resolvePublicEmail(cms.site?.contactEmail);
  const [mapLoaded, setMapLoaded] = useState(false);

  const columns = useMemo(() => {
    const footerItems = cms.navItems.filter(
      (n: { groupKey?: string }) => (n.groupKey ?? 'main') !== 'main',
    );
    if (!footerItems.length) {
      return fallbackColumns.map((col) =>
        col.groupKey === 'contact'
          ? {
              ...col,
              links: col.links.map((l) =>
                l.href.startsWith('mailto:') ? { ...l, href: `mailto:${contactEmail}`, label: contactEmail } : l,
              ),
            }
          : col,
      );
    }

    const groups = new Map<string, { title: string; links: { href: string; label: string }[] }>();
    for (const item of footerItems.sort(
      (a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder,
    )) {
      const key = item.groupKey ?? 'footer';
      const title = key.charAt(0).toUpperCase() + key.slice(1);
      if (!groups.has(key)) groups.set(key, { title, links: [] });
      groups.get(key)!.links.push({ href: item.href, label: item.label });
    }
    return [...groups.values()];
  }, [cms.navItems, contactEmail]);

  return (
    <footer className="border-t border-border-light bg-bg-secondary">
      <div className="mx-auto max-w-7xl px-6 pb-28 pt-14 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr_1fr_1.2fr]">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-serif text-lg font-medium">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group relative inline-block rounded-sm text-sm text-text-secondary transition hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                      {...(link.href.startsWith('https://wa.me')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {link.label}
                      <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-brand-gold transition-all duration-300 group-hover:w-full" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="overflow-hidden rounded-2xl border border-border bg-bg-card shadow-card">
            {mapLoaded ? (
              <iframe
                title={`${BUSINESS_NAP.brand} office location — ${BUSINESS_ADDRESS_LINE}`}
                src={`https://maps.google.com/maps?q=${MAPS_EMBED_QUERY}&z=12&output=embed`}
                className="h-44 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <button
                type="button"
                onClick={() => setMapLoaded(true)}
                className="flex h-44 w-full flex-col items-center justify-center gap-1 bg-bg-elevated px-4 text-sm text-text-secondary"
              >
                <span className="font-medium text-text-primary">Show map</span>
                <span>{BUSINESS_ADDRESS_LINE}</span>
              </button>
            )}
            <div className="space-y-2 border-t border-border-light px-4 py-3 text-xs text-text-muted">
              <p className="font-medium text-text-secondary">
                {BUSINESS_NAP.legalName} · {BUSINESS_ADDRESS_LINE}
              </p>
              <ul className="space-y-1.5">
                <li>
                  <a href={BUSINESS_TEL_HREF} className="inline-flex items-center gap-2 text-brand-gold hover:underline">
                    <PhoneIcon className="h-3.5 w-3.5" />
                    {BUSINESS_NAP.telephone}
                  </a>
                </li>
                <li>
                  <a
                    href={BUSINESS_WHATSAPP_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-brand-gold hover:underline"
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5" />
                    {BUSINESS_NAP.whatsapp}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="inline-flex items-center gap-2 text-brand-gold hover:underline"
                  >
                    <MailIcon className="h-3.5 w-3.5" />
                    {contactEmail}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-6 border-t border-border-light pt-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <a
              href={BUSINESS_WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with us on WhatsApp"
              className={`${socialIconClass} hover:!border-[#25D366] hover:!bg-[#25D366]`}
            >
              <WhatsAppIcon className="h-5 w-5" />
            </a>
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className={socialIconClass}
              >
                {social.icon}
              </a>
            ))}
          </div>
          <div className="text-right">
            <p className="text-sm text-text-muted">
              © {new Date().getFullYear()} {CULLINOS_BRAND.name}. {CULLINOS_BRAND.poweredBy}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {BUSINESS_NAP.legalName} · {BUSINESS_ADDRESS_LINE}
            </p>
            <div className="mt-2 flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-text-muted">
              {guideLinks.map((link) => (
                <Link key={link.href} href={link.href} className="transition hover:text-text-primary">
                  {link.label}
                </Link>
              ))}
              <Link href="/privacy" className="transition hover:text-text-primary">
                Privacy
              </Link>
              <Link href="/terms" className="transition hover:text-text-primary">
                Terms
              </Link>
              <Link href="/refund-policy" className="transition hover:text-text-primary">
                Refunds
              </Link>
              <Link href="/cancellation-policy" className="transition hover:text-text-primary">
                Cancellation
              </Link>
              <Link href="/shipping-policy" className="transition hover:text-text-primary">
                Shipping
              </Link>
              <Link href="/delete-account" className="transition hover:text-text-primary">
                Delete account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
