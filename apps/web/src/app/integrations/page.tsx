import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { INTEGRATION_CATEGORIES } from '@cullinos/shared';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Integrations',
  description:
    'Connect Cullinos with hardware printers, payment gateways, hotel PMS, and notification services.',
  path: '/integrations',
});

export default function IntegrationsPage() {
  return (
    <>
      <Hero
        eyebrow="Integrations"
        title="Connect your existing stack"
        subtitle="Hardware adapters ship with the Local Gateway. Payment and PMS integrations are on our roadmap — we're building honestly."
      />
      <Section title="Integration categories">
        <div className="grid gap-6 md:grid-cols-2">
          {INTEGRATION_CATEGORIES.map((category) => (
            <article
              key={category.title}
              className="rounded-xl border border-border-light bg-bg-card shadow-card p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{category.title}</h3>
                <StatusBadge status={category.status} />
              </div>
              <p className="mt-2 text-sm text-text-secondary">{category.description}</p>
              <ul className="mt-4 space-y-2">
                {category.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="text-brand-gold">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>
      <CTABanner
        title="Need a specific integration?"
        description="Tell us about your hardware, payment provider, or PMS and we'll prioritize your workflow."
        primaryLabel="Contact us"
        primaryHref="/contact"
        secondaryLabel="View features"
        secondaryHref="/features"
      />
    </>
  );
}

function StatusBadge({ status }: { status: 'available' | 'coming_soon' }) {
  if (status === 'available') {
    return (
      <span className="shrink-0 rounded-full bg-status-success/10 px-2 py-0.5 text-xs text-status-success">
        Available
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-status-warning/10 px-2 py-0.5 text-xs text-status-warning">
      Coming soon
    </span>
  );
}
