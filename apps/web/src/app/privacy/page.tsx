import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { BUSINESS_ADDRESS_LINE, BUSINESS_NAP } from '@/lib/business';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Privacy Policy',
  description: 'Cullinos privacy policy — how Rkyves collects, uses, and protects your data.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <>
      <Hero
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle="Last updated: September 6, 2026. This is a template — have legal counsel review before production use."
        primaryCta={{ label: 'Contact us', href: '/contact' }}
        secondaryCta={null}
      />
      <Section title="">
        <div className="prose-marketing mx-auto max-w-3xl">
          <h2>1. Introduction</h2>
          <p>
            {BUSINESS_NAP.legalName} (&quot;we&quot;, &quot;us&quot;) operates {BUSINESS_NAP.brand}, a Restaurant
            Operating System delivered as software-as-a-service. This Privacy Policy explains how we collect, use,
            and protect information when you use our website and platform.
          </p>

          <h2>2. Information we collect</h2>
          <ul>
            <li>Account information: name, email, phone, organization details</li>
            <li>Business data: menu, orders, inventory, staff, and customer records you enter</li>
            <li>Usage data: logs, device information, and cookieless web analytics</li>
            <li>Contact form submissions from this website (protected by Cloudflare Turnstile)</li>
          </ul>

          <h2>3. How we use information</h2>
          <p>
            We use your information to provide and improve Cullinos, process subscriptions, send service
            communications, and respond to support requests. We do not sell your personal data.
          </p>

          <h2>4. Cookies and similar technologies</h2>
          <p>
            Essential cookies and similar technologies may be used for security (including Cloudflare Turnstile on
            forms). We use Cloudflare Web Analytics, which is designed to be cookieless. You can manage preferences
            via the cookie notice on this site.
          </p>

          <h2>5. Data storage and security</h2>
          <p>
            Data is stored on secure cloud infrastructure. We implement access controls, encryption in transit, and
            regular backups. You are responsible for managing staff access within your organization.
          </p>

          <h2>6. Your rights</h2>
          <p>
            You may request access, correction, or deletion of your personal data by contacting us. Organization
            owners can export business data from the admin dashboard where available.
          </p>

          <h2>7. Contact</h2>
          <p>
            For privacy inquiries, email{' '}
            <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a> or use our{' '}
            <a href="/contact">contact form</a>. Operator: {BUSINESS_NAP.legalName}, {BUSINESS_ADDRESS_LINE}. Street
            address and phone will be published here when available — keep Google Business Profile in sync with this
            page.
          </p>
        </div>
      </Section>
    </>
  );
}
