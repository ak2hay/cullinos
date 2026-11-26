import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { FeatureGlanceNav } from '@/components/marketing/FeatureGlanceNav';
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
        title="Restaurant POS and GST billing software"
        subtitle="POS, kitchen display, KOT, waiter app, and online ordering on one menu. Inventory and CRM are on higher plans. Prices exclude GST."
        primaryCta={{ label: 'Start 30-day free trial', href: 'https://admin.cullinos.com/register' }}
        secondaryCta={{ label: 'View pricing', href: '/pricing' }}
      />
      <Section title="All features at a glance">
        <FeatureGlanceNav />
        <FeatureSections sections={FEATURE_SECTIONS} />
      </Section>
      <CTABanner />
    </>
  );
}
