import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { ContactForm } from '@/components/marketing/ContactForm';
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
        subtitle="Questions about pricing, Enterprise rollout, or Hospitality deployments? Send us a message and we'll respond within one business day."
        primaryCta={{ label: 'Email hello@rkyves.com', href: 'mailto:hello@rkyves.com' }}
        secondaryCta={null}
      />
      <Section title="Send a message">
        <div className="mx-auto max-w-2xl">
          <ContactForm />
        </div>
      </Section>
    </>
  );
}
