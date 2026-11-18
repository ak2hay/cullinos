import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { BUSINESS_ADDRESS_LINE, BUSINESS_NAP } from '@/lib/business';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Cancellation Policy',
  description:
    'How to cancel a Cullinos SaaS subscription. Access continues through the period already paid; renewal stops after cancellation.',
  path: '/cancellation-policy',
});

export default function CancellationPolicyPage() {
  return (
    <>
      <Hero
        eyebrow="Legal"
        title="Cancellation Policy"
        subtitle="Last updated: November 18, 2026. You can cancel a Cullinos subscription at any time."
        primaryCta={{ label: 'Contact us', href: '/contact' }}
        secondaryCta={{ label: 'Refund policy', href: '/refund-policy' }}
      />
      <Section title="">
        <div className="prose-marketing mx-auto max-w-3xl">
          <h2>1. How to cancel</h2>
          <p>Cancel in either of these ways:</p>
          <ul>
            <li>From billing in the admin portal, where that control is available on your plan</li>
            <li>
              By emailing <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a> from the account email,
              with the restaurant name, or by using our <a href="/contact">contact form</a>
            </li>
          </ul>
          <p>
            We confirm the cancellation by email and record the date it takes effect. Send the request before the
            next renewal date if you do not want another charge.
          </p>

          <h2>2. What cancellation does</h2>
          <ul>
            <li>We stop charging for later periods once the cancellation is recorded before the next renewal.</li>
            <li>You keep access through the end of the period you have already paid for.</li>
            <li>A free trial cancelled before it converts to a paid plan is not charged.</li>
            <li>
              Fees already paid are refunded only as described in our <a href="/refund-policy">refund policy</a>.
            </li>
          </ul>

          <h2>3. Custom contracts</h2>
          <p>
            Enterprise and Hospitality cancellations follow the notice period in the written agreement. If the
            agreement does not set one, email us and we will confirm the end date before closing the subscription.
          </p>

          <h2>4. After the paid period ends</h2>
          <p>
            Download reports you need before access ends. After the paid period ends, sign-in to that restaurant
            workspace stops. Cancelling does not immediately erase menus, orders, staff profiles, or guest data.
            Retention is described in our <a href="/privacy">privacy policy</a>. To ask us to delete an account and
            personal data, use <a href="/delete-account">delete account</a>.
          </p>
          <p>
            Operator: {BUSINESS_NAP.legalName}, {BUSINESS_ADDRESS_LINE}.
          </p>
        </div>
      </Section>
    </>
  );
}
