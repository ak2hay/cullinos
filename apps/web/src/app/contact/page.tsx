import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { ContactForm } from '@/components/marketing/ContactForm';
import { MailIcon, PhoneIcon, WhatsAppIcon } from '@/components/marketing/ContactIcons';
import {
  BUSINESS_ADDRESS_LINE,
  BUSINESS_MAILTO_HREF,
  BUSINESS_NAP,
  BUSINESS_TEL_HREF,
  BUSINESS_WHATSAPP_HREF,
} from '@/lib/business';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Contact',
  description: 'Book a demo or contact the Cullinos sales team about Enterprise and Hospitality plans.',
  path: '/contact',
});

const contactChannels = [
  {
    key: 'call',
    label: 'Call us',
    value: BUSINESS_NAP.telephone,
    hint: 'Speak to our team',
    href: BUSINESS_TEL_HREF,
    external: false,
    Icon: PhoneIcon,
    iconClass: 'bg-brand-gold/15 text-brand-gold',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    value: BUSINESS_NAP.whatsapp,
    hint: 'Chat with our team',
    href: BUSINESS_WHATSAPP_HREF,
    external: true,
    Icon: WhatsAppIcon,
    iconClass: 'bg-[#25D366]/15 text-[#1ea952]',
  },
  {
    key: 'email',
    label: 'Email',
    value: BUSINESS_NAP.email,
    hint: 'We reply within one business day',
    href: BUSINESS_MAILTO_HREF,
    external: false,
    Icon: MailIcon,
    iconClass: 'bg-brand-gold/15 text-brand-gold',
  },
] as const;

export default function ContactPage() {
  return (
    <>
      <Hero
        eyebrow="Contact"
        title="Talk to our team"
        subtitle={`Questions about pricing, Enterprise rollout, or Hospitality deployments? Send us a message and we'll respond within one business day. ${BUSINESS_NAP.legalName} · ${BUSINESS_ADDRESS_LINE}.`}
        primaryCta={{ label: 'Chat on WhatsApp', href: BUSINESS_WHATSAPP_HREF }}
        secondaryCta={{ label: `Call ${BUSINESS_NAP.telephone}`, href: BUSINESS_TEL_HREF }}
      />
      <Section title="Reach us directly">
        <ul className="grid max-w-4xl gap-4 sm:grid-cols-3">
          {contactChannels.map(({ key, label, value, hint, href, external, Icon, iconClass }) => (
            <li key={key}>
              <a
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-border-light bg-bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-full ${iconClass}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-[0.15em] text-text-muted">
                    {label}
                  </span>
                  <span className="mt-1 block break-words text-base font-medium text-text-primary group-hover:text-brand-gold">
                    {value}
                  </span>
                  <span className="mt-1 block text-xs text-text-muted">{hint}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Send a message">
        <div className="mx-auto max-w-2xl">
          <ContactForm />
        </div>
      </Section>
    </>
  );
}
