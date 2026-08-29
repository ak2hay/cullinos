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
        title="Every tool to run your restaurant"
        subtitle="Cullinos includes POS, kitchen display, waiter app, online ordering, inventory, CRM, and enterprise management — all connected on one platform."
        primaryCta={{ label: 'Start free trial', href: 'https://admin.cullinos.com/register' }}
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
