import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Chains & Franchise',
  description:
    'Multi-outlet restaurant management with consolidated analytics, franchise tools, and stock transfer.',
  path: '/solutions/chains',
});

const modules = [
  'Enterprise management console at manage.cullinos.com',
  'Consolidated analytics across outlets',
  'Multi-brand and franchise support',
  'Stock transfer between locations',
  'Outlet comparison and benchmarking',
  'Role-based access per outlet and region',
];

export default function ChainsSolutionPage() {
  return (
    <>
      <Hero
        eyebrow="Solutions"
        title="Scale across outlets without losing control"
        subtitle="Run a chain or franchise network from one enterprise console while each outlet keeps local POS speed."
      />
      <Section title="Built for operators who manage many locations">
        <div className="grid gap-6 md:grid-cols-3">
          <StatCard label="Up to 50 outlets" detail="Enterprise plan" />
          <StatCard label="200 users" detail="Central and outlet staff" />
          <StatCard label="API access" detail="Integrate with your stack" />
        </div>
      </Section>
      <Section title="Enterprise capabilities" className="bg-bg-secondary/50">
        <ul className="grid gap-3 sm:grid-cols-2">
          {modules.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="text-brand-primary">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-text-muted">
          Best fit: <strong className="text-text-primary">Enterprise</strong> plan.{' '}
          <Link href="/contact?plan=enterprise" className="text-brand-primary hover:underline">
            Contact sales
          </Link>
        </p>
      </Section>
      <Section title="Customer stories">
        <div className="rounded-xl border border-dashed border-white/10 bg-bg-card p-8 text-center text-text-secondary">
          Franchise case studies coming soon.{' '}
          <Link href="/contact" className="text-brand-primary hover:underline">
            Talk to our team
          </Link>{' '}
          about multi-outlet rollout.
        </div>
      </Section>
      <CTABanner
        primaryLabel="Contact sales"
        primaryHref="/contact?plan=enterprise"
        secondaryLabel="View pricing"
        secondaryHref="/pricing"
      />
    </>
  );
}

function StatCard({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-bg-card p-6 text-center">
      <p className="text-2xl font-semibold text-brand-primary">{label}</p>
      <p className="mt-1 text-sm text-text-secondary">{detail}</p>
    </div>
  );
}
