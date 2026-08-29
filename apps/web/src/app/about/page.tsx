import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { CULLINOS_BRAND, CULLINOS_ELEVATOR_PITCH } from '@cullinos/shared';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'About',
  description: `Learn about ${CULLINOS_BRAND.name} by ${CULLINOS_BRAND.parent} — a Restaurant Operating System built for India.`,
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <Hero
        eyebrow="About"
        title={`${CULLINOS_BRAND.name} by ${CULLINOS_BRAND.parent}`}
        subtitle="We're building the operating system for modern restaurants — starting in India, designed to scale globally."
      />
      <Section title="Our mission">
        <div className="max-w-3xl space-y-4 text-text-secondary">
          <p className="text-lg text-text-primary">{CULLINOS_ELEVATOR_PITCH.headline}</p>
          <p>{CULLINOS_ELEVATOR_PITCH.subline}</p>
          <p>
            Restaurants run on dozens of disconnected tools: a POS here, a kitchen printer there, spreadsheets
            for inventory, and separate apps for online ordering. {CULLINOS_BRAND.name} replaces that patchwork
            with one unified platform.
          </p>
          <p>
            {CULLINOS_BRAND.parent} created {CULLINOS_BRAND.name} to give operators a single source of truth —
            from the cashier and kitchen to the back office and enterprise console. Every order, regardless of
            channel, flows through one engine.
          </p>
          <p>
            We built India-first: GST billing, INR pricing, Asia/Kolkata defaults, and offline POS via the Local
            Gateway because connectivity isn't guaranteed in every outlet.
          </p>
        </div>
      </Section>
      <Section title="What we believe" className="bg-bg-secondary/50">
        <div className="grid gap-6 md:grid-cols-3">
          <ValueCard
            title="Honest product"
            description="We label what's live and what's coming soon. No vaporware on our marketing site."
          />
          <ValueCard
            title="Operator-first"
            description="Every feature exists because restaurant teams need it — not because it looks good in a slide deck."
          />
          <ValueCard
            title="Scale without replatforming"
            description="Start with one outlet on Starter. Grow to a hotel chain on Hospitality — same platform."
          />
        </div>
      </Section>
      <CTABanner />
    </>
  );
}

function ValueCard({ title, description }: { title: string; description: string }) {
  return (
    <article className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-card">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
    </article>
  );
}
