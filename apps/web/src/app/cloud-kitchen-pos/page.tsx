import Link from 'next/link';
import { FounderBand } from '@/components/marketing/FounderBand';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Cloud kitchen POS',
  description:
    'Cloud kitchen POS with counter billing, KOT, online orders, and delivery management. GST-ready. 30-day free trial, no card needed.',
  path: '/cloud-kitchen-pos',
});

export default function CloudKitchenPage() {
  return (
    <>
      <Hero
        eyebrow="Cloud kitchens"
        title="Cloud kitchen POS"
        subtitle="Run a delivery-first kitchen with counter billing, kitchen tickets, and your own online orders on one menu. GST tax groups apply to every bill."
      />
      <Section title="Built for a kitchen without a dining room">
        <ul className="grid gap-4 md:grid-cols-2">
          {[
            {
              title: 'Counter checkout',
              body: 'The QSR plan adds counter mode and a pickup queue so packed orders have a number, not a table.',
            },
            {
              title: 'Tickets in the kitchen',
              body: 'Orders from the cashier or your online storefront print as KOTs and show on the kitchen display.',
            },
            {
              title: 'Your own delivery',
              body: 'Delivery management is part of the Professional plan. You dispatch orders you took yourself.',
            },
            {
              title: 'More than one brand',
              body: 'Multi-brand menus are on the Enterprise plan when one kitchen cooks for more than one brand.',
            },
          ].map((item) => (
            <li key={item.title} className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-card">
              <h3 className="font-serif text-xl">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-text-secondary">
          Marketplace apps such as Swiggy and Zomato are not offered as a live connection in the restaurant admin
          yet. Use Cullinos for your own POS, online orders, and kitchen tickets, then talk to us if you need a
          specific channel.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/pricing" className="text-brand-gold hover:underline">
            See QSR and Professional pricing + GST
          </Link>
        </p>
      </Section>
      <FounderBand />
      <CTABanner title="Open the kitchen on a 30-day trial" description="No card needed. Free setup and menu upload." />
    </>
  );
}
