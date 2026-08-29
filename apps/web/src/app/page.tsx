import Link from 'next/link';
import { PRODUCT_MODULES, TRUST_PILLARS } from '@cullinos/shared';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';
import { PricingTeaser } from '@/components/marketing/PricingTable';
import { SoftwareApplicationJsonLd } from '@/components/marketing/JsonLd';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({});

export default function HomePage() {
  return (
    <>
      <SoftwareApplicationJsonLd />
      <Hero
        title={
          <>
            Run your restaurant
            <br />
            <span className="text-brand-primary">from one place.</span>
          </>
        }
        subtitle="Menu, orders, inventory, staff, and analytics — unified for modern restaurant operations."
      />

      <Section
        eyebrow="Built for India"
        title="Everything your restaurant needs"
        description="GST-ready billing, offline POS, and a platform that scales from one outlet to hotel chains."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {TRUST_PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-xl border border-white/5 bg-bg-secondary p-6">
              <h3 className="font-semibold">{pillar.title}</h3>
              <p className="mt-2 text-sm text-text-secondary">{pillar.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Product"
        title="One platform for every part of your operation"
        className="bg-bg-secondary/50"
      >
        <FeatureGrid items={PRODUCT_MODULES} />
      </Section>

      <Section
        eyebrow="Architecture"
        title="Cloud when you're online. Local when you're not."
        description="Cullinos runs on a cloud API with dedicated apps for each role. The Local Gateway keeps POS and KDS running offline and syncs when connectivity returns."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-bg-card p-6">
            <h3 className="font-semibold text-brand-primary">Cloud backend</h3>
            <ul className="mt-4 space-y-2 text-sm text-text-secondary">
              <li>Unified order engine across all channels</li>
              <li>Multi-tenant org and outlet management</li>
              <li>Real-time WebSocket updates for KDS and orders</li>
              <li>Subscription plans with feature entitlements</li>
            </ul>
          </div>
          <div className="rounded-xl border border-white/5 bg-bg-card p-6">
            <h3 className="font-semibold text-brand-primary">Local Gateway</h3>
            <ul className="mt-4 space-y-2 text-sm text-text-secondary">
              <li>Offline POS and kitchen display</li>
              <li>Queued sync when internet returns</li>
              <li>Hardware adapters for printers and cash drawer</li>
              <li>Electron app for on-premise reliability</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section eyebrow="Pricing" title="Plans that grow with you">
        <PricingTeaser />
        <div className="mt-8 text-center">
          <Link
            href="/pricing"
            className="text-sm font-medium text-brand-primary hover:text-brand-primary-dark"
          >
            Compare all plans and features →
          </Link>
        </div>
      </Section>

      <CTABanner />
    </>
  );
}
