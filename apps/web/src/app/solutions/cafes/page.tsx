import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { MarketingImage } from '@/components/marketing/MarketingImage';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Cafes & Coffee Shops',
  description: 'Cullinos for cafes — counter POS, order queue, loyalty stamps, QR ordering, and scheduled menus.',
  path: '/solutions/cafes',
});

const modules = [
  'Counter-service POS with order numbers',
  'Customer-facing pickup queue display',
  'Stamp-card loyalty for regulars',
  'QR ordering for table or takeaway',
  'Breakfast and afternoon menu schedules',
  'Peak-hour sales reports',
];

export default function CafesSolutionPage() {
  return (
    <>
      <Hero
        eyebrow="Solutions"
        title="Built for cafes and coffee shops"
        subtitle="Fast counter checkout, morning rush queue management, and loyalty that keeps regulars coming back."
      />
      <Section title="Skip the table setup">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <p className="text-sm leading-relaxed text-text-secondary">
            Cafes don&apos;t need floor plans. Cullinos counter mode gives you order numbers, name-on-ticket,
            pickup vs eat-in, and a customer-facing queue board for the morning rush.
          </p>
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border-light bg-bg-dark shadow-card">
            <MarketingImage imageKey="mockupPos" alt="Cullinos counter POS for cafes" fill className="object-cover object-top" sizes="50vw" />
          </div>
        </div>
      </Section>
      <Section title="What cafes get">
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
