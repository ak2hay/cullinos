import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
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
              <span className="text-brand-primary">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-text-muted">
          Best fit: <strong className="text-text-primary">Professional</strong> plan.{' '}
          <Link href="/pricing" className="text-brand-primary hover:underline">
            View pricing
          </Link>
        </p>
      </Section>
      <Section title="Customer stories">
        <div className="rounded-xl border border-dashed border-white/10 bg-bg-card p-8 text-center text-text-secondary">
          Case studies coming soon. Be among our first restaurant partners —{' '}
          <Link href="/contact" className="text-brand-primary hover:underline">
            get in touch
          </Link>
          .
        </div>
      </Section>
      <CTABanner />
    </>
  );
}

function PainPoint({ title, description }: { title: string; description: string }) {
  return (
    <article className="rounded-xl border border-white/5 bg-bg-secondary p-6">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
    </article>
  );
}
