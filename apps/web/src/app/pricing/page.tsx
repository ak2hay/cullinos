import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { PricingTable } from '@/components/marketing/PricingTable';
import { formatInr, MARKETING_PLANS } from '@cullinos/shared';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Pricing',
  description: `Cullinos pricing from ${formatInr(MARKETING_PLANS[0].priceMonthly)}/month + GST. Compare Starter, QSR / Food SMB, Professional, Enterprise, and Hospitality plans. 30-day free trial, no card needed.`,
  path: '/pricing',
});

export default function PricingPage() {
  return (
    <>
      <Hero
        eyebrow="Pricing"
        title="Restaurant POS pricing, plus GST"
        subtitle="Starter does not include inventory. Talk to us for Enterprise and Hospitality. Every price below is + GST."
        primaryCta={{ label: 'Start 30-day free trial', href: 'https://admin.cullinos.com/register' }}
        secondaryCta={{ label: 'Contact sales', href: '/contact' }}
      />
      <Section
        title="Choose your plan"
        description="Every plan includes cloud hosting, software updates, and support. Prices are + GST. Pick Starter or Professional to begin — contact us for Enterprise and Hospitality."
      >
        <PricingTable />
      </Section>
      <CTABanner
        title="Need a custom deployment?"
        description="Enterprise and Hospitality plans include dedicated onboarding, multi-outlet setup, and integration support."
        primaryLabel="Contact sales"
        primaryHref="/contact"
        secondaryLabel="Start 30-day free trial"
        secondaryHref="https://admin.cullinos.com/register"
      />
    </>
  );
}
