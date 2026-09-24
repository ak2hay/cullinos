import type { ReactNode } from 'react';
import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { CULLINOS_BRAND } from '@cullinos/shared';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'FAQ',
  description: `Answers to common questions about ${CULLINOS_BRAND.name}: setup, billing and tax, devices, apps, and support.`,
  path: '/faq',
});

const faqs: Array<{ q: string; a: ReactNode }> = [
  {
    q: `What is ${CULLINOS_BRAND.name}?`,
    a: `${CULLINOS_BRAND.name} is a restaurant operating system: POS, kitchen display, menu, inventory, staff, orders and reports in one platform, run from a web admin portal.`,
  },
  {
    q: 'How do I get started?',
    a: (
      <>
        Start a free trial from the admin portal or{' '}
        <Link href="/contact?intent=trial" className="text-brand-gold hover:underline">
          talk to our team
        </Link>
        . Setup walks you through restaurant details, outlets, menu and staff.
      </>
    ),
  },
  {
    q: 'How does GST work on bills?',
    a: 'You set up tax groups (for example CGST + SGST) and assign them to menu items. Bills and order details show the tax breakdown. Your accountant should confirm rates and handle GST filings — we do not file returns for you.',
  },
  {
    q: 'Which payment methods can I accept?',
    a: 'Cash is always available at the POS. For UPI and cards, connect your own payment gateway account in Settings → Payments; online tender stays off until a gateway is configured for your outlet.',
  },
  {
    q: 'What devices do I need?',
    a: 'The admin portal, POS and kitchen display run in a modern browser on a PC, laptop or tablet. The waiter app is Android-only for now.',
  },
  {
    q: 'Is there a guest ordering app?',
    a: 'The guest app is being rolled out on Android. Until your restaurant has it live, staff take orders through the POS or waiter app.',
  },
  {
    q: 'Can I run more than one outlet?',
    a: 'Yes. Each outlet has its own details, devices and pricing, managed from one admin account.',
  },
  {
    q: 'Which languages are supported?',
    a: 'The admin portal is available in English, Hindi, Marathi, Gujarati, Tamil, Bengali, Telugu, Kannada, Malayalam and Punjabi. Translations are being reviewed by native speakers.',
  },
  {
    q: 'How do I get support?',
    a: (
      <>
        Reach us through the{' '}
        <Link href="/contact" className="text-brand-gold hover:underline">
          contact page
        </Link>
        .
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <>
      <Hero
        eyebrow="FAQ"
        title="Frequently asked questions"
        subtitle={`Straight answers about what ${CULLINOS_BRAND.name} does today.`}
      />
      <Section title="Questions">
        <div className="mx-auto max-w-3xl divide-y divide-border-light">
          {faqs.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {item.q}
                <span aria-hidden="true" className="text-brand-gold transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="mt-3 text-sm leading-relaxed text-text-secondary">{item.a}</div>
            </details>
          ))}
        </div>
      </Section>
      <CTABanner />
    </>
  );
}
