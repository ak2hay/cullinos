import Link from 'next/link';
import { formatInr, MARKETING_PLANS, TRIAL_CTA_LABEL } from '@cullinos/shared';
import { FounderBand } from '@/components/marketing/FounderBand';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { createMetadata } from '@/lib/metadata';

const starter = MARKETING_PLANS[0];

export const metadata = createMetadata({
  title: 'Restaurant billing software Mumbai',
  description:
    'Restaurant billing software in Mumbai with GST tax groups on every bill, KOT, and online orders. 30-day free trial, no card needed. Prices exclude GST.',
  path: '/restaurant-billing-software-mumbai',
});

export default function MumbaiBillingPage() {
  return (
    <>
      <Hero
        eyebrow="Mumbai"
        title="Restaurant billing software in Mumbai"
        subtitle="Cullinos is restaurant POS and GST billing software built in Mumbai. Set tax groups such as CGST and SGST on menu items, and every bill shows the breakdown."
      />
      <Section title="What the bill actually does">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-card">
            <h3 className="font-serif text-xl">GST on the receipt</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              You create tax groups and assign them to items. Bills and order details show the tax lines. Your
              accountant still confirms rates and files returns — Cullinos does not file GST for you.
            </p>
          </article>
          <article className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-card">
            <h3 className="font-serif text-xl">Cashier, kitchen, and online</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              The same menu feeds the POS, kitchen order tickets, and online orders. Starter includes POS,
              billing, KOT, tables, kitchen display, and QR or online ordering.
            </p>
          </article>
          <article className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-card">
            <h3 className="font-serif text-xl">Payments when you are ready</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Cash works at the POS without a gateway. Connect your own Razorpay account in Settings → Payments
              for UPI and cards. The 30-day trial does not ask for a card.
            </p>
          </article>
          <article className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-card">
            <h3 className="font-serif text-xl">A Mumbai team</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Setup and menu upload are free for a new restaurant. Plans start at {formatInr(starter.priceMonthly)}
              /month + GST for one outlet.
            </p>
          </article>
        </div>
        <p className="mt-8 text-sm text-text-secondary">
          <Link href="/pricing" className="text-brand-gold hover:underline">
            Compare plans
          </Link>
          {' · '}
          <Link href="/kot-software" className="text-brand-gold hover:underline">
            KOT software
          </Link>
          {' · '}
          <Link href="/contact" className="text-brand-gold hover:underline">
            Talk to us in Mumbai
          </Link>
        </p>
      </Section>
      <FounderBand />
      <CTABanner
        title="Start billing this month"
        description={`${TRIAL_CTA_LABEL}. Free setup and menu upload. Prices on the pricing page are + GST.`}
      />
    </>
  );
}
