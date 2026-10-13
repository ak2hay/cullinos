import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { BreadcrumbJsonLd } from '@/components/marketing/JsonLd';
import { COMPARE_PAGES } from '@/lib/compare-pages';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Compare Restaurant POS Software | Cullinos',
  description:
    'Compare restaurant POS software in India on fit: kitchen display, QR ordering, live stock and food cost. Guides from Cullinos, by Rkyves.',
  path: '/compare',
});

export default function CompareHubPage() {
  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: 'Compare', path: '/compare' }]} />
      <Hero
        eyebrow="Compare"
        title="Compare restaurant POS software"
        subtitle="Guides to help you choose a restaurant POS in India on fit, not rankings. Check each vendor's current features and pricing directly."
        primaryCta={{ label: 'Talk to the Cullinos team', href: '/contact' }}
        secondaryCta={{ label: 'All features', href: '/features' }}
      />
      <Section title="Guides">
        <ul className="grid gap-4 sm:grid-cols-2">
          {COMPARE_PAGES.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/compare/${page.slug}`}
                className="block h-full rounded-2xl border border-border-light bg-bg-card p-5 shadow-card transition hover:border-brand-gold"
              >
                <span className="font-medium">{page.h1}</span>
                <span className="mt-2 block text-sm text-text-secondary">{page.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <CTABanner />
    </>
  );
}
