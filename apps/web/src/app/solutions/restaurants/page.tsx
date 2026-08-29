import Link from 'next/link';
import { ComingSoonCard } from '@/components/marketing/ComingSoonCard';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { MarketingImage } from '@/components/marketing/MarketingImage';
import { CULLINOS_ELEVATOR_PITCH } from '@cullinos/shared';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Restaurants',
  description: 'Cullinos for single-outlet and full-service restaurants. POS, KDS, tables, ordering, and back office.',
  path: '/solutions/restaurants',
});

const modules = [
  'Touch-optimized POS with GST billing',
  'Kitchen display and KOT routing',
  'Waiter app for table-side ordering',
  'QR and online ordering channels',
  'Menu, inventory, and staff management',
  'CRM, loyalty, and delivery',
];

export default function RestaurantsSolutionPage() {
  return (
    <>
      <Hero
        eyebrow="Solutions"
        title="Built for full-service restaurants"
        subtitle="Replace disconnected POS, kitchen printers, and spreadsheets with one platform designed for Indian restaurants."
      />
      <Section title="Built for your daily operations">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <p className="text-sm leading-relaxed text-text-secondary">
            {CULLINOS_ELEVATOR_PITCH.subline} Run your cashier, kitchen, waiter app, and online orders from one
            platform — designed for Indian restaurants.
          </p>
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border-light bg-bg-dark shadow-card">
            <MarketingImage imageKey="mockupPos" alt="Cullinos POS for restaurants" fill className="object-cover object-top" sizes="50vw" />
          </div>
        </div>
      </Section>
      <Section title="Pain points we solve">
        <div className="grid gap-6 md:grid-cols-2">
          <PainPoint
            title="Orders lost between floor and kitchen"
            description="Unified order engine routes every channel — POS, waiter, QR, and online — to KDS in real time."
          />
          <PainPoint
            title="GST compliance is manual and error-prone"
            description="CGST, SGST, and IGST are built into billing from day one with India-first defaults."
          />
          <PainPoint
            title="Internet outages stop service"
            description="Local Gateway keeps POS and KDS running offline and syncs when you're back online."
          />
          <PainPoint
            title="Too many tools, no single view"
            description="Admin dashboard for menu, inventory, staff, orders, and reports — one login."
          />
        </div>
      </Section>
      <Section title="Recommended modules" className="bg-bg-secondary/50">
        <ul className="grid gap-3 sm:grid-cols-2">
          {modules.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="text-brand-gold">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-text-muted">
          Best fit: <strong className="text-text-primary">Professional</strong> plan.{' '}
          <Link href="/pricing" className="text-brand-gold hover:underline">
            View pricing
          </Link>
        </p>
      </Section>
      <Section title="Customer stories">
        <ComingSoonCard message="Case studies coming soon. Be among our first restaurant partners and share your story with us." />
      </Section>
      <CTABanner />
    </>
  );
}

function PainPoint({ title, description }: { title: string; description: string }) {
  return (
    <article className="rounded-xl border border-border-light bg-bg-card shadow-card p-6">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
    </article>
  );
}
