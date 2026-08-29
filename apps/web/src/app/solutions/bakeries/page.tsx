import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { MarketingImage } from '@/components/marketing/MarketingImage';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Bakeries & Patisseries',
  description: 'Cullinos for bakeries — production batches, recipe scaling, expiry tracking, pre-orders, and wholesale pricing.',
  path: '/solutions/bakeries',
});

const modules = [
  'Daily production sheets and batch planning',
  'Recipe scaling — bake 2x or 3x in one click',
  'Shelf-life and expiry alerts',
  'Pre-orders with deposits for cakes and catering',
  'Wholesale and retail pricing',
  'Allergen labels on menu items',
];

export default function BakeriesSolutionPage() {
  return (
    <>
      <Hero
        eyebrow="Solutions"
        title="Built for bakeries and patisseries"
        subtitle="Plan your bake, track batches, sell at the counter, and take custom cake orders — all in one system."
      />
      <Section title="Production meets retail">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <p className="text-sm leading-relaxed text-text-secondary">
            Bakeries are half kitchen, half shop. Cullinos links production batches to recipes and inventory,
            so when you complete a bake sheet, stock deducts automatically.
          </p>
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border-light bg-bg-dark shadow-card">
            <MarketingImage imageKey="mockupAdmin" alt="Cullinos production planning for bakeries" fill className="object-cover object-top" sizes="50vw" />
          </div>
        </div>
      </Section>
      <Section title="What bakeries get">
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
      <CTABanner />
    </>
  );
}
