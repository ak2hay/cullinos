import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { FeatureSections } from '@/components/marketing/FeatureGrid';
import { FEATURE_SECTIONS } from '@cullinos/shared';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Features',
  description:
    'Explore Cullinos modules: POS, KDS, waiter app, QR ordering, inventory, CRM, enterprise management, and hospitality.',
  path: '/features',
});

export default function FeaturesPage() {
  return (
    <>
      <Hero
        eyebrow="Features"
        title="Every module your restaurant needs"
        subtitle="From the cashier to the kitchen, from QR ordering to multi-outlet analytics — Cullinos covers the full stack."
        primaryCta={{ label: 'Start free trial', href: 'https://admin.cullinos.com/register' }}
        secondaryCta={{ label: 'View pricing', href: '/pricing' }}
      />
      <Section title="Product modules">
        <FeatureSections sections={FEATURE_SECTIONS} />
      </Section>
      <CTABanner />
    </>
  );
}
