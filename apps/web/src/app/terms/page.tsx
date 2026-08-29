import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Terms of Service',
  description: 'Cullinos terms of service — subscription billing, acceptable use, and service terms.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <>
      <Hero
        eyebrow="Legal"
        title="Terms of Service"
        subtitle="Last updated: August 29, 2026. This is a template — have legal counsel review before production use."
        primaryCta={{ label: 'Contact us', href: '/contact' }}
        secondaryCta={null}
      />
      <Section title="">
        <div className="prose-marketing mx-auto max-w-3xl">
          <h2>1. Agreement</h2>
          <p>
            By accessing Cullinos or creating an account, you agree to these Terms of Service. If you are using
            Cullinos on behalf of an organization, you represent that you have authority to bind that organization.
          </p>

          <h2>2. Service description</h2>
          <p>
            Cullinos is a subscription-based Restaurant Operating System provided by Rkyves. Features available to
            your organization depend on your subscription plan and may change as we improve the product.
          </p>

          <h2>3. Subscriptions and billing</h2>
          <ul>
            <li>Plans are billed monthly or yearly in INR unless otherwise agreed</li>
            <li>Prices are listed on our pricing page and may change with notice</li>
            <li>Failure to pay may result in suspension of service</li>
            <li>Refunds are handled per our refund policy communicated at purchase</li>
          </ul>

          <h2>4. Acceptable use</h2>
          <p>
            You agree not to misuse the platform, attempt unauthorized access, reverse engineer the software, or
            use Cullinos for unlawful purposes. You are responsible for activity under your accounts.
          </p>

          <h2>5. Data and ownership</h2>
          <p>
            You retain ownership of business data you enter into Cullinos. We require a license to host and process
            that data solely to provide the service. See our Privacy Policy for details.
          </p>

          <h2>6. Limitation of liability</h2>
          <p>
            Cullinos is provided &quot;as is&quot; to the extent permitted by law. Rkyves is not liable for indirect
            or consequential damages arising from use of the service.
          </p>

          <h2>7. Contact</h2>
          <p>
            Questions about these terms: hello@rkyves.com or our{' '}
            <a href="/contact">contact form</a>.
          </p>
        </div>
      </Section>
    </>
  );
}
