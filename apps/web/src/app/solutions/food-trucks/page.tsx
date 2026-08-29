import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { MarketingImage } from '@/components/marketing/MarketingImage';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Food Trucks & Pop-ups',
  description: 'Cullinos for food trucks — mobile POS, offline sync, event scheduling, and pre-orders.',
  path: '/solutions/food-trucks',
});

const modules = [
  'Counter POS — no tables or floor plan needed',
  'Offline Gateway for poor event connectivity',
  'Event and location calendar',
  'Pre-order windows before you arrive',
  'QR ordering for festival crowds',
  'Compact inventory for daily prep',
];

export default function FoodTrucksSolutionPage() {
  return (
    <>
      <Hero
        eyebrow="Solutions"
        title="Built for food trucks and pop-ups"
        subtitle="Take orders anywhere — festivals, markets, corporate parks — with offline-first POS and event scheduling."
      />
      <Section title="Mobile by design">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <p className="text-sm leading-relaxed text-text-secondary">
            Your kitchen moves every day. Schedule events with location pins, accept pre-orders before you
            arrive, and keep selling when the network drops with local Gateway sync.
          </p>
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border-light bg-bg-dark shadow-card">
            <MarketingImage imageKey="mockupPos" alt="Cullinos mobile POS for food trucks" fill className="object-cover object-top" sizes="50vw" />
          </div>
        </div>
      </Section>
      <Section title="What food trucks get">
        <ul className="grid gap-3 sm:grid-cols-2">
          {modules.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="text-brand-gold">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-text-muted">
          Best fit: <strong className="text-text-primary">QSR / Food SMB</strong> plan.{' '}
          <Link href="/pricing" className="text-brand-gold hover:underline">
            View pricing
          </Link>
        </p>
      </Section>
      <CTABanner />
    </>
  );
}
