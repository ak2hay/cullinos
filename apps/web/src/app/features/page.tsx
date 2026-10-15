import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { BreadcrumbJsonLd } from '@/components/marketing/JsonLd';
import { FeatureGlanceNav } from '@/components/marketing/FeatureGlanceNav';
import { FeatureSections } from '@/components/marketing/FeatureGrid';
import { FEATURE_SECTIONS } from '@cullinos/shared';
import { FEATURE_PAGES } from '@/lib/feature-pages';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Cullinos POS Features: Billing, KDS, QR Ordering, Inventory',
  description:
    'Cullinos POS billing, kitchen display, QR table ordering, live stock with low-stock alerts, wastage log and recipe-wise food cost, in one login.',
  path: '/features',
});

export default function FeaturesPage() {
  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: 'Features', path: '/features' }]} />
      <Hero
        eyebrow="Features"
        title="Every tool to run your restaurant"
        subtitle="Cullinos includes POS, kitchen display, waiter app, online ordering, inventory, CRM, and enterprise management — all connected on one platform."
        primaryCta={{ label: 'Start 30-day free trial', href: 'https://admin.cullinos.com/register' }}
        secondaryCta={{ label: 'View pricing', href: '/pricing' }}
      />
      <Section title="Explore in depth">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_PAGES.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/features/${page.slug}`}
                className="block h-full rounded-2xl border border-border-light bg-bg-card p-5 shadow-card transition hover:border-brand-gold"
              >
                <span className="font-medium">{page.name}</span>
                <span className="mt-2 block text-sm text-text-secondary">{page.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="All features at a glance">
        <FeatureGlanceNav />
        <FeatureSections sections={FEATURE_SECTIONS} />
      </Section>
      <CTABanner />
    </>
  );
}
