import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { PricingTable } from '@/components/marketing/PricingTable';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Pricing',
  description:
    'Cullinos pricing from ₹999/month. Compare Starter, Professional, Enterprise, and Hospitality plans.',
  path: '/pricing',
});

export default function PricingPage() {
  return (
    <>
      <Hero
        eyebrow="Pricing"
        title="Simple plans, powerful platform"
        subtitle="Start with Starter or Professional. Talk to us for Enterprise and Hospitality deployments."
        primaryCta={{ label: 'Start free trial', href: 'https://admin.cullinos.com/register' }}
        secondaryCta={{ label: 'Contact sales', href: '/contact' }}
      />
      <Section
        title="Choose your plan"
        description="Every plan includes cloud hosting, software updates, and support. Pick Starter or Professional to begin — contact us for Enterprise and Hospitality."
      >
        <PricingTable />
      </Section>
      <CTABanner
        title="Need a custom deployment?"
        description="Enterprise and Hospitality plans include dedicated onboarding, multi-outlet setup, and integration support."
        primaryLabel="Contact sales"
        primaryHref="/contact"
        secondaryLabel="Start free trial"
        secondaryHref="https://admin.cullinos.com/register"
      />
    </>
  );
}
