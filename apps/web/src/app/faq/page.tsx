import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'FAQ',
  description:
    'Frequently asked questions about Cullinos — including how GST line types appear on restaurant bills.',
  path: '/faq',
});

export default function FaqPage() {
  return (
    <>
      <Hero
        eyebrow="Help"
        title="FAQ"
        subtitle="Short answers about Cullinos. This page is a stub — not tax or legal advice."
        primaryCta={{ label: 'Contact us', href: '/contact' }}
        secondaryCta={null}
      />
      <Section title="">
        <div className="prose-marketing mx-auto max-w-3xl">
          <h2>How does Cullinos show GST on restaurant bills?</h2>
          <p>
            Cullinos can present GST on bills using the standard Indian GST line types{' '}
            <strong>CGST</strong>, <strong>SGST</strong>, and <strong>IGST</strong> (matching the{' '}
            <code>GST_TYPES</code> values in our tax-engine package). Which lines apply depends on whether a
            sale is treated as intra-state or inter-state; exact rates and wiring are still evolving in the
            product.
          </p>
          <p>
            We do not publish specific GST rates here. Rates and filing obligations are set by applicable law
            and your advisor — this page is a marketing stub about line types, not a substitute for a
            chartered accountant or tax advisor.
          </p>
          <p className="text-sm text-text-muted">
            Stub FAQ — not tax advice. Have counsel or a tax professional review before relying on this for
            compliance.
          </p>
        </div>
      </Section>
    </>
  );
}
