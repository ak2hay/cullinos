import Link from 'next/link';
import { FounderBand } from '@/components/marketing/FounderBand';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'KOT software',
  description:
    'KOT software for restaurants: kitchen order tickets from the POS, waiter app, and QR orders, on the kitchen display. Included on the Starter plan. 30-day free trial.',
  path: '/kot-software',
});

export default function KotSoftwarePage() {
  return (
    <>
      <Hero
        eyebrow="Kitchen"
        title="KOT software for restaurants"
        subtitle="Kitchen order tickets leave the cashier, the waiter app, or a QR order and show up on the kitchen display. Starter includes KOT and the kitchen display."
      />
      <Section title="How a ticket moves">
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: '1',
              title: 'An order is placed',
              body: 'POS, waiter app, or QR dine-in. Online orders use the same menu.',
            },
            {
              step: '2',
              title: 'The kitchen gets a KOT',
              body: 'Items route to the kitchen display. The kitchen display can print a ticket on the printer set as the system default.',
            },
            {
              step: '3',
              title: 'The bill stays in GST',
              body: 'The same order becomes the bill, with the tax group you set on each item.',
            },
          ].map((item) => (
            <li key={item.step} className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-card">
              <p className="text-xs font-medium tracking-wide text-brand-gold uppercase">Step {item.step}</p>
              <h3 className="mt-2 font-serif text-xl">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-text-secondary">
          The POS and kitchen display run in a browser, and there is a Windows desktop shell for the POS and KDS.
          Both talk to the cloud API while you are online.{' '}
          <Link href="/features" className="text-brand-gold hover:underline">
            See the rest of the product
          </Link>
          .
        </p>
      </Section>
      <FounderBand />
      <CTABanner
        title="Print your first KOT on a free trial"
        description="30-day free trial · no card needed. Free setup and menu upload."
      />
    </>
  );
}
