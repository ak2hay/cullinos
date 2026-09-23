import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { BUSINESS_ADDRESS_LINE, BUSINESS_NAP } from '@/lib/business';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Privacy Policy',
  description:
    'Cullinos privacy policy under India’s Digital Personal Data Protection Act — how Rkyves collects, uses, and protects personal data.',
  path: '/privacy',
});

const SUB_PROCESSORS = [
  { name: 'Neon', purpose: 'PostgreSQL database hosting' },
  { name: 'Cloudflare', purpose: 'CDN, Turnstile, optional analytics, object storage (R2)' },
  { name: 'MSG91', purpose: 'OTP SMS delivery' },
  { name: 'Razorpay', purpose: 'Payment processing' },
  { name: 'Resend / SMTP providers', purpose: 'Transactional and promotional email' },
];

export default function PrivacyPage() {
  return (
    <>
      <Hero
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle="Last updated: September 10, 2026. Aligned with India’s Digital Personal Data Protection Act, 2023 (DPDP). Have counsel confirm grievance officer details before production go-live."
        primaryCta={{ label: 'Contact us', href: '/contact' }}
        secondaryCta={null}
      />
      <Section title="">
        <div className="prose-marketing mx-auto max-w-3xl">
          <h2>1. Who we are (Data Fiduciary / Processor)</h2>
          <p>
            {BUSINESS_NAP.legalName} (&quot;we&quot;, &quot;us&quot;) operates {BUSINESS_NAP.brand}, a Restaurant
            Operating System delivered as software-as-a-service. For platform account and billing data, we act as a{' '}
            <strong>Data Fiduciary</strong>. For customer, guest, and order personal data entered by a restaurant
            (tenant), the restaurant is typically the Data Fiduciary and we act as a <strong>Data Processor</strong>{' '}
            on their behalf.
          </p>

          <h2>2. Information we collect</h2>
          <ul>
            <li>Account information: name, email, phone, organization details (GSTIN/PAN where provided)</li>
            <li>Business data: menu, orders, inventory, staff, and customer/guest records you enter</li>
            <li>Authentication data: hashed passwords, hashed OTP codes, short-lived OTP challenges</li>
            <li>Hospitality ID details when used for hotel check-in (encrypted at rest when configured)</li>
            <li>Usage data: operational logs (with PII redaction where practical) and optional analytics</li>
            <li>Contact form submissions from this website (protected by Cloudflare Turnstile)</li>
            <li>Marketing preference and consent records (purpose, notice version, timestamp, source)</li>
          </ul>

          <h2>3. Purpose of processing</h2>
          <p>We process personal data only for specified purposes, including:</p>
          <ul>
            <li>Account authentication and security (OTP / login)</li>
            <li>Providing restaurant operations (orders, loyalty, hospitality, support)</li>
            <li>Subscription billing and platform administration</li>
            <li>Promotional email/SMS — only with recorded opt-in consent, which you may withdraw</li>
            <li>Optional cookieless analytics when you accept non-essential cookies on this site</li>
          </ul>
          <p>We do not sell your personal data.</p>

          <h2>4. Consent and notice</h2>
          <p>
            Where processing is based on consent (for example marketing), consent is free, specific, informed,
            unconditional, and clear. You may withdraw marketing consent via unsubscribe links, in-product
            preferences, or by contacting us. Withdrawal does not affect processing already completed.
          </p>

          <h2>5. Cookies and similar technologies</h2>
          <p>
            Essential cookies and similar technologies may be used for security (including Cloudflare Turnstile on
            forms). Non-essential Cloudflare Web Analytics loads only after you Accept the cookie notice. Declining
            keeps essential security functions available.
          </p>

          <h2>6. Your rights (Data Principal)</h2>
          <p>Subject to applicable law, you may request:</p>
          <ul>
            <li>Access to your personal data</li>
            <li>Correction of inaccurate or incomplete data</li>
            <li>Erasure / anonymization where we are not required to retain records</li>
            <li>Withdrawal of consent for marketing</li>
            <li>Grievance redressal</li>
          </ul>
          <p>
            Customers signed in to the ordering app can use in-product privacy endpoints (export / preferences /
            erase). Organization staff can export or anonymize customer and guest records from the admin tools where
            enabled. You may also email the grievance officer below.
          </p>

          <h2>7. Retention</h2>
          <p>
            OTP challenges are purged after a short retention window. Impersonation handoff codes are short-lived.
            Inactive customer profiles may be anonymized after a configured inactivity period. Consent and audit
            records may be retained as required for compliance and security.
          </p>

          <h2>8. Children</h2>
          <p>
            Cullinos is not directed at children. We do not knowingly process personal data of individuals under 18
            for marketing. Restaurant tenants are responsible for age-appropriate collection in their venues.
          </p>

          <h2>9. Cross-border transfers and sub-processors</h2>
          <p>
            Data may be processed using cloud infrastructure and vendors that may store or process data outside India.
            We use contractual and technical safeguards appropriate to the service. Current sub-processors:
          </p>
          <ul>
            {SUB_PROCESSORS.map((sp) => (
              <li key={sp.name}>
                <strong>{sp.name}</strong> — {sp.purpose}
              </li>
            ))}
          </ul>

          <h2>10. Security</h2>
          <p>
            We implement access controls, encryption in transit, hashed credentials/OTPs, encryption of platform
            secrets and (when configured) guest ID documents, and operational audit logging. You are responsible for
            managing staff access within your organization.
          </p>

          <h2>11. Grievance officer</h2>
          <p>
            Grievance Officer: Privacy Desk
            <br />
            Email:{' '}
            <a href="mailto:privacy@rkyves.com">privacy@rkyves.com</a>
            <br />
            Alternate:{' '}
            <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a>
            <br />
            Operator: {BUSINESS_NAP.legalName}, {BUSINESS_ADDRESS_LINE}.
          </p>
          <p>
            We aim to acknowledge grievances promptly and resolve them within timelines under applicable DPDP rules.
            You may also use our <a href="/contact">contact form</a>.
          </p>
        </div>
      </Section>
    </>
  );
}
