import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Hotels & Resorts',
  description:
    'Cullinos Hospitality: room service, room posting, banquet billing, and hotel PMS integrations.',
  path: '/solutions/hospitality',
});

const modules = [
  'Room service ordering to kitchen and front desk',
  'Charge F&B to guest folios (room posting)',
  'Banquet and event menu packages',
  'Multi-outlet F&B across property restaurants',
  'Hospitality integrations (PMS roadmap)',
  'Enterprise analytics for F&B revenue',
];

export default function HospitalitySolutionPage() {
  return (
    <>
      <Hero
        eyebrow="Solutions"
        title="F&B operations for hotels and resorts"
        subtitle="Extend Cullinos beyond standalone restaurants with room service, banquet, and folio posting built in."
      />
      <Section title="Hospitality-specific workflows">
        <div className="grid gap-6 md:grid-cols-2">
          <ModuleCard
            title="Room service"
            description="Guests order in-room; orders route to kitchen with room number and delivery tracking."
          />
          <ModuleCard
            title="Room posting"
            description="Post restaurant and bar charges directly to guest folios without manual reconciliation."
          />
          <ModuleCard
            title="Banquet & events"
            description="Event menus, packages, and billing for conferences, weddings, and functions."
          />
          <ModuleCard
            title="Multi-outlet F&B"
            description="Manage restaurants, bars, poolside, and in-room dining from one hospitality plan."
          />
        </div>
      </Section>
      <Section title="Everything in Enterprise, plus hospitality" className="bg-bg-secondary/50">
        <ul className="grid gap-3 sm:grid-cols-2">
          {modules.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="text-brand-primary">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-text-muted">
          Best fit: <strong className="text-text-primary">Hospitality</strong> plan.{' '}
          <Link href="/contact?plan=hospitality" className="text-brand-primary hover:underline">
            Contact sales
          </Link>
        </p>
      </Section>
      <CTABanner
        title="Deploy Cullinos across your property"
        primaryLabel="Contact sales"
        primaryHref="/contact?plan=hospitality"
        secondaryLabel="View pricing"
        secondaryHref="/pricing"
      />
    </>
  );
}

function ModuleCard({ title, description }: { title: string; description: string }) {
  return (
    <article className="rounded-xl border border-white/5 bg-bg-secondary p-6">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
    </article>
  );
}
