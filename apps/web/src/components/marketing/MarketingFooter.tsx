'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useMarketingCms } from '@/components/marketing/MarketingCmsProvider';
import { BUSINESS_NAP, BUSINESS_SERVICE_AREA } from '@/lib/business';

const fallbackColumns = [
  {
    title: 'Product',
    groupKey: 'product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/integrations', label: 'Integrations' },
      { href: '/compare', label: 'Compare' },
      { href: '/blog', label: 'Blog' },
    ],
  },
  {
    title: 'Solutions',
    groupKey: 'solutions',
    links: [
      { href: '/solutions/restaurants', label: 'Restaurants' },
      { href: '/solutions/cafes', label: 'Cafes' },
      { href: '/solutions/food-trucks', label: 'Food trucks' },
      { href: '/solutions/bakeries', label: 'Bakeries' },
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
      { href: `mailto:${BUSINESS_NAP.email}`, label: BUSINESS_NAP.email },
    ],
  },
];

const socialLinks = [
  { label: 'Rkyves on LinkedIn', href: BUSINESS_NAP.linkedin, icon: 'in' },
  { label: 'Rkyves on Instagram', href: BUSINESS_NAP.instagram, icon: 'ig' },
];

export function MarketingFooter() {
  const cms = useMarketingCms();
  const contactEmail = cms.site?.contactEmail ?? BUSINESS_NAP.email;

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
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr_1fr_1.2fr]">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-serif text-lg font-medium">{col.title}</h3>
              <ul className="mt-4 md:space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group relative inline-flex min-h-11 items-center text-sm text-text-secondary transition hover:text-text-primary md:min-h-0"
                    >
                      {link.label}
                      <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-brand-gold transition-all duration-300 group-hover:w-full" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="rounded-2xl border border-border bg-bg-card p-5 shadow-card">
            <p className="font-serif text-lg font-medium">{BUSINESS_NAP.brandLine}</p>
            <p className="mt-2 text-sm text-text-secondary">{BUSINESS_SERVICE_AREA}</p>
            <p className="mt-3 text-sm">
              <a
                href={`tel:${BUSINESS_NAP.telephone.replace(/\s/g, '')}`}
                className="inline-flex min-h-11 items-center text-brand-gold hover:underline md:min-h-0"
              >
                {BUSINESS_NAP.telephone}
              </a>
              <br />
              <a
                href={`mailto:${contactEmail}`}
                className="inline-flex min-h-11 items-center text-brand-gold hover:underline md:min-h-0"
              >
                {contactEmail}
              </a>
            </p>
            <p className="mt-3 text-xs text-text-muted">
              Built by{' '}
              <a href="https://www.rkyves.com" className="text-brand-gold hover:underline">
                Rkyves
              </a>
              , an Indian software company.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-6 border-t border-border-light pt-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                target="_blank"
                rel="noopener"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border-light bg-bg-card text-[10px] font-semibold uppercase text-text-secondary transition hover:border-brand-gold hover:bg-brand-gold hover:text-white"
              >
                {social.icon}
              </a>
            ))}
          </div>
          <div className="text-right">
            <p className="text-sm text-text-muted">
              © {new Date().getFullYear()} {BUSINESS_NAP.brandLine}
            </p>
            <p className="mt-1 text-xs text-text-muted">{BUSINESS_SERVICE_AREA}</p>
            <div className="mt-2 flex gap-4 text-xs text-text-muted">
              <Link href="/privacy" className="inline-flex min-h-11 items-center transition hover:text-text-primary md:min-h-0">
                Privacy
              </Link>
              <Link href="/terms" className="inline-flex min-h-11 items-center transition hover:text-text-primary md:min-h-0">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
