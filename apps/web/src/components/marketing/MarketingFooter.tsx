import Link from 'next/link';
import { CULLINOS_BRAND } from '@cullinos/shared';
import { Logo } from './Logo';

const footerLinks = {
  Product: [
    { href: '/features', label: 'Features' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/integrations', label: 'Integrations' },
    { href: '/blog', label: 'Blog' },
  ],
  Solutions: [
    { href: '/solutions/restaurants', label: 'Restaurants' },
    { href: '/solutions/chains', label: 'Chains & Franchise' },
    { href: '/solutions/hospitality', label: 'Hotels & Resorts' },
  ],
  Company: [
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
  ],
};

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/5 bg-bg-secondary">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo showTagline />
            <p className="mt-4 max-w-sm text-sm text-text-secondary">
              {CULLINOS_BRAND.tagline} by {CULLINOS_BRAND.parent}. Unified restaurant operations for
              India and beyond.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
              <ul className="mt-4 space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-secondary transition hover:text-brand-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
          <p className="text-sm text-text-muted">
            © {new Date().getFullYear()} {CULLINOS_BRAND.name}. All rights reserved.
          </p>
          <p className="text-sm text-text-muted">{CULLINOS_BRAND.poweredBy}</p>
        </div>
      </div>
    </footer>
  );
}
