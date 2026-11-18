import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { BUSINESS_ADDRESS_LINE, BUSINESS_NAP } from '@/lib/business';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Refund Policy',
  description:
    'Cullinos refund policy for monthly and yearly SaaS subscriptions. Software is delivered digitally; there are no physical goods.',
  path: '/refund-policy',
});

export default function RefundPolicyPage() {
  return (
    <>
      <Hero
        eyebrow="Legal"
        title="Refund Policy"
        subtitle="Last updated: November 18, 2026. Cullinos is subscription software for restaurants. Plans are billed monthly or yearly in INR."
        primaryCta={{ label: 'Contact us', href: '/contact' }}
        secondaryCta={{ label: 'See pricing', href: '/pricing' }}
      />
      <Section title="">
        <div className="prose-marketing mx-auto max-w-3xl">
          <h2>1. What you are paying for</h2>
          <p>
            {BUSINESS_NAP.legalName} provides {BUSINESS_NAP.brand} as a subscription. Prices for Starter, QSR,
            and Professional plans are listed on our <a href="/pricing">pricing page</a>. Enterprise and
            Hospitality plans are quoted separately. There is no physical product and no shipping charge. Access
            is delivered digitally when a paid subscription is activated, or when a free trial converts to a paid
            plan.
          </p>

          <h2>2. Free trial</h2>
          <p>
            If you cancel before a free trial converts to a paid plan, you are not charged for that trial.
          </p>

          <h2>3. Monthly plans</h2>
          <p>
            You can cancel a monthly plan at any time. Cancellation stops the next renewal. The fee already paid
            for the current month is not refunded, and access continues until the end of that paid period. We
            refund a monthly charge when we cannot provide the service and cannot restore it within a reasonable
            time, or when the law requires a refund.
          </p>

          <h2>4. Yearly plans</h2>
          <p>
            You can cancel a yearly plan at any time. Cancellation stops renewal at the end of the current term.
            If you cancel within 14 days of the first payment for that yearly term and ask us to close the
            subscription, we refund the unused portion of that term, minus payment-gateway fees we cannot recover.
            After those 14 days, fees already paid for the current yearly term are not refunded. Access continues
            until the end of the paid term.
          </p>

          <h2>5. Custom plans</h2>
          <p>
            Enterprise and Hospitality subscriptions follow the written order or agreement. Where that agreement
            does not set a refund rule, this policy applies.
          </p>

          <h2>6. How to request a refund</h2>
          <p>
            Email <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a> or use our{' '}
            <a href="/contact">contact form</a>. Include the restaurant name, the billing email, and the charge
            date. Approved refunds go back to the original payment method. Banks and the payment gateway typically
            take 5–10 business days to show the credit.
          </p>
          <p>
            If a charge looks wrong, contact us before opening a payment dispute so we can match it to the
            subscription and correct it.
          </p>

          <h2>7. Cancellation and data</h2>
          <p>
            Stopping renewal is described in our <a href="/cancellation-policy">cancellation policy</a>. Cancelling
            does not by itself delete restaurant or guest data. To ask for account and personal-data deletion, use{' '}
            <a href="/delete-account">delete account</a>. Delivery of the software is described in our{' '}
            <a href="/shipping-policy">shipping policy</a>.
          </p>
          <p>
            Operator: {BUSINESS_NAP.legalName}, {BUSINESS_ADDRESS_LINE}.
          </p>
        </div>
      </Section>
    </>
  );
}
