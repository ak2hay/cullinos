import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { BUSINESS_ADDRESS_LINE, BUSINESS_NAP } from '@/lib/business';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Shipping Policy',
  description:
    'Cullinos is SaaS software for restaurants. There is no physical shipping. The service is delivered digitally when a subscription is activated.',
  path: '/shipping-policy',
});

export default function ShippingPolicyPage() {
  return (
    <>
      <Hero
        eyebrow="Legal"
        title="Shipping Policy"
        subtitle="Last updated: November 18, 2026. Cullinos is software. Nothing is shipped."
        primaryCta={{ label: 'Contact us', href: '/contact' }}
        secondaryCta={null}
      />
      <Section title="">
        <div className="prose-marketing mx-auto max-w-3xl">
          <h2>1. No physical shipping</h2>
          <p>
            {BUSINESS_NAP.brand} is software-as-a-service for restaurants, operated by {BUSINESS_NAP.legalName}. We
            do not sell or ship physical goods. There are no shipping charges, delivery windows, couriers, or
            tracking numbers on a Cullinos subscription.
          </p>

          <h2>2. Digital delivery</h2>
          <p>
            The service is delivered digitally when the subscription is activated. From that moment, the
            restaurant&apos;s users can sign in to the Cullinos admin portal and the apps included in the plan
            (such as point of sale, kitchen display, and the guest ordering app, depending on the plan). Setup is
            done in the product. We do not mail software, cards, or hardware as part of the subscription.
          </p>

          <h2>3. Hardware from someone else</h2>
          <p>
            Printers, terminals, and other devices bought from a separate vendor are not shipped by{' '}
            {BUSINESS_NAP.legalName}. Questions about those shipments go to that seller.
          </p>

          <h2>4. Contact</h2>
          <p>
            Questions about access after activation:{' '}
            <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a> or our{' '}
            <a href="/contact">contact form</a>. Billing changes are covered by our{' '}
            <a href="/refund-policy">refund policy</a> and <a href="/cancellation-policy">cancellation policy</a>.
          </p>
          <p>
            Operator: {BUSINESS_NAP.legalName}, {BUSINESS_ADDRESS_LINE}.
          </p>
        </div>
      </Section>
    </>
  );
}
