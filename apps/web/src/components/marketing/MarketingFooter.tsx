'use client';

import Link from 'next/link';
import { CULLINOS_BRAND } from '@cullinos/shared';
import { useMemo } from 'react';
import { useMarketingCms } from '@/components/marketing/MarketingCmsProvider';

const fallbackColumns = [
  {
    title: 'Product',
    groupKey: 'product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/integrations', label: 'Integrations' },
      { href: '/blog', label: 'Blog' },
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
      { href: '/about', label: 'About us' },
      { href: 'mailto:hello@rkyves.com', label: 'hello@rkyves.com' },
    ],
  },
];

const socialLinks = [
  { label: 'LinkedIn', href: '#', icon: 'in' },
  { label: 'Twitter', href: '#', icon: 'X' },
  { label: 'Instagram', href: '#', icon: 'ig' },
];

export function MarketingFooter() {
  const cms = useMarketingCms();
  const contactEmail = cms.site?.contactEmail ?? 'hello@rkyves.com';

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
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group relative inline-block text-sm text-text-secondary transition hover:text-text-primary"
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
            <iframe
              title="Cullinos office location"
              src="https://maps.google.com/maps?q=Mumbai%2C%20India&z=12&output=embed"
              className="h-44 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-6 border-t border-border-light pt-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border-light bg-bg-card text-[10px] font-semibold uppercase text-text-secondary transition hover:border-brand-gold hover:bg-brand-gold hover:text-white"
              >
                {social.icon}
              </a>
            ))}
          </div>
          <div className="text-right">
            <p className="text-sm text-text-muted">
              © {new Date().getFullYear()} {CULLINOS_BRAND.name}. {CULLINOS_BRAND.poweredBy}
            </p>
            <div className="mt-2 flex gap-4 text-xs text-text-muted">
              <Link href="/privacy" className="transition hover:text-text-primary">
                Privacy
              </Link>
              <Link href="/terms" className="transition hover:text-text-primary">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
