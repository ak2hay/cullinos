import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { BreadcrumbJsonLd, JsonLd } from '@/components/marketing/JsonLd';
import { COMPARE_LAST_REVIEWED, COMPARE_PAGES, getComparePage, VENDOR_CHECKLIST } from '@/lib/compare-pages';
import { createMetadata } from '@/lib/metadata';

export const dynamicParams = false;

const CULLINOS_FEATURES = [
  { label: 'POS billing with tax shown on every bill', slug: 'restaurant-pos' },
  { label: 'Kitchen display (KDS) in place of paper KOTs', slug: 'kitchen-display-system' },
  { label: 'QR table ordering into the same kitchen queue', slug: 'qr-ordering' },
  { label: 'Inventory with a live stock view', slug: 'inventory-management' },
  { label: 'Low-stock alerts before you run out', slug: 'inventory-management' },
  { label: 'Wastage log', slug: 'inventory-management' },
  { label: 'Recipe-wise food cost', slug: 'recipe-management' },
];

export function generateStaticParams() {
  return COMPARE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getComparePage(slug);
  if (!page) notFound();
  return createMetadata({ title: page.title, description: page.description, path: `/compare/${slug}` });
}

export default async function ComparePageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getComparePage(slug);
  if (!page) notFound();
  const names = page.competitors.map((c) => c.name).join(', ');

  return (
    <>
      <BreadcrumbJsonLd
        trail={[
          { name: 'Compare', path: '/compare' },
          { name: page.h1, path: `/compare/${slug}` },
        ]}
      />
      <JsonLd
        data={{
          '@type': 'FAQPage',
          mainEntity: page.faqs.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }}
      />
      <Hero
        eyebrow="Compare"
        title={page.h1}
        subtitle={page.intro}
        primaryCta={{ label: 'Talk to the Cullinos team', href: '/contact' }}
        secondaryCta={{ label: 'All features', href: '/features' }}
      />
      <Section title={page.competitors.length > 1 ? 'Restaurant POS providers in India' : `What ${names} is`}>
        <ul className="max-w-3xl space-y-3 text-text-secondary">
          {page.competitors.map((c) => (
            <li key={c.name}>
              {c.about}{' '}
              <a href={c.url} rel="nofollow noopener" target="_blank" className="text-brand-gold hover:underline">
                Official website
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl text-sm text-text-muted">
          Check each vendor&apos;s current features and pricing directly.
        </p>
      </Section>
      <Section title="What Cullinos, by Rkyves does" className="bg-bg-secondary/50">
        <ul className="grid max-w-3xl gap-3 sm:grid-cols-2">
          {CULLINOS_FEATURES.map((f) => (
            <li key={f.label} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="text-brand-gold">✓</span>
              <Link href={`/features/${f.slug}`} className="hover:text-text-primary hover:underline">
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Questions to ask any vendor">
        <ol className="max-w-3xl list-decimal space-y-2 pl-5 text-text-secondary">
          {VENDOR_CHECKLIST.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </Section>
      <Section title="When Cullinos may fit" className="bg-bg-secondary/50">
        <p className="max-w-3xl leading-relaxed text-text-secondary">
          Cullinos may fit if you want billing, kitchen, stock and food cost connected in one login: bills that reach
          the kitchen display instantly, QR table orders in the same queue, a live stock view with low-stock alerts, a
          wastage log and recipe-wise food cost, for restaurants across India.
        </p>
      </Section>
      <Section title="FAQ">
        <div className="max-w-3xl divide-y divide-border-light">
          {page.faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <span aria-hidden="true" className="text-brand-gold transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-10 max-w-3xl text-xs text-text-muted">
          {names} {page.competitors.length > 1 ? 'are trademarks' : 'is a trademark'} of their owners. This page
          isn&apos;t affiliated with them. Last reviewed {COMPARE_LAST_REVIEWED}.
        </p>
      </Section>
      <CTABanner
        title="Talk to the Cullinos team"
        description="Tell us about your outlet and we will show you how Cullinos fits."
        primaryLabel="Talk to us"
        primaryHref="/contact"
        secondaryLabel="All features"
        secondaryHref="/features"
      />
    </>
  );
}
