import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
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
        subtitle="Last updated: August 29, 2026. This is a template — have legal counsel review before production use."
        primaryCta={{ label: 'Contact us', href: '/contact' }}
        secondaryCta={null}
      />
      <Section title="">
        <div className="prose-marketing mx-auto max-w-3xl">
          <h2>1. Introduction</h2>
          <p>
            Rkyves (&quot;we&quot;, &quot;us&quot;) operates Cullinos, a Restaurant Operating System delivered as
            software-as-a-service. This Privacy Policy explains how we collect, use, and protect information when
            you use our website and platform.
          </p>

          <h2>2. Information we collect</h2>
          <ul>
            <li>Account information: name, email, phone, organization details</li>
            <li>Business data: menu, orders, inventory, staff, and customer records you enter</li>
            <li>Usage data: logs, device information, and analytics to improve the service</li>
            <li>Contact form submissions from this website</li>
          </ul>

          <h2>3. How we use information</h2>
          <p>
            We use your information to provide and improve Cullinos, process subscriptions, send service
            communications, and respond to support requests. We do not sell your personal data.
          </p>

          <h2>4. Data storage and security</h2>
          <p>
            Data is stored on secure cloud infrastructure. We implement access controls, encryption in transit, and
            regular backups. You are responsible for managing staff access within your organization.
          </p>

          <h2>5. Your rights</h2>
          <p>
            You may request access, correction, or deletion of your personal data by contacting us. Organization
            owners can export business data from the admin dashboard where available.
          </p>

          <h2>6. Contact</h2>
          <p>
            For privacy inquiries, email hello@rkyves.com or use our{' '}
            <a href="/contact">contact form</a>.
          </p>
        </div>
      </Section>
    </>
  );
}
