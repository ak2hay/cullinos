import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { ContactForm } from '@/components/marketing/ContactForm';
import { BUSINESS_ADDRESS_LINE, BUSINESS_NAP } from '@/lib/business';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Contact',
  description: 'Book a demo or contact the Cullinos sales team about Enterprise and Hospitality plans.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <>
      <Hero
        eyebrow="Contact"
        title="Talk to our team"
        subtitle={`Questions about pricing, Enterprise rollout, or Hospitality deployments? Send us a message and we'll respond within one business day. ${BUSINESS_NAP.legalName} · ${BUSINESS_ADDRESS_LINE}.`}
        primaryCta={{ label: `Email ${BUSINESS_NAP.email}`, href: `mailto:${BUSINESS_NAP.email}` }}
        secondaryCta={
          BUSINESS_NAP.telephone
            ? {
                label: `Call ${BUSINESS_NAP.telephone}`,
                href: `tel:${BUSINESS_NAP.telephone.replace(/\s/g, '')}`,
              }
            : null
        }
      />
      <Section title="Send a message">
        <div className="mx-auto max-w-2xl">
          <p className="mb-6 text-sm text-text-secondary">
            {BUSINESS_NAP.legalName} · {BUSINESS_ADDRESS_LINE} ·{' '}
            {BUSINESS_NAP.telephone ? (
              <>
                <a
                  href={`tel:${BUSINESS_NAP.telephone.replace(/\s/g, '')}`}
                  className="text-brand-gold hover:underline"
                >
                  {BUSINESS_NAP.telephone}
                </a>
                {' · '}
              </>
            ) : null}
            <a href={`mailto:${BUSINESS_NAP.email}`} className="text-brand-gold hover:underline">
              {BUSINESS_NAP.email}
            </a>
          </p>
          <ContactForm />
        </div>
      </Section>
    </>
  );
}
