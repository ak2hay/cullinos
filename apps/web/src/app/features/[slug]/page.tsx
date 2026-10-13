import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { CTABanner } from '@/components/marketing/CTABanner';
import { BreadcrumbJsonLd, JsonLd } from '@/components/marketing/JsonLd';
import { FEATURE_PAGE_SLUGS, getFeaturePage } from '@/lib/feature-pages';
import { createMetadata } from '@/lib/metadata';

export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURE_PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getFeaturePage(slug);
  if (!page) notFound();
  return createMetadata({ title: page.title, description: page.description, path: `/features/${slug}` });
}

export default async function FeaturePageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getFeaturePage(slug);
  if (!page) notFound();
  const related = getFeaturePage(page.related);

  return (
    <>
      <BreadcrumbJsonLd
        trail={[
          { name: 'Features', path: '/features' },
          { name: page.name, path: `/features/${slug}` },
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
        eyebrow="Features"
        title={page.h1}
        subtitle={page.intro}
        primaryCta={{ label: 'Talk to us', href: '/contact' }}
        secondaryCta={{ label: 'All features', href: '/features' }}
      />
      {page.sections.map((section, i) => (
        <Section key={section.heading} title={section.heading} className={i % 2 ? 'bg-bg-secondary/50' : ''}>
          <div className="max-w-3xl space-y-4 leading-relaxed text-text-secondary">
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 32)}>{p}</p>
            ))}
          </div>
        </Section>
      ))}
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
        <p className="mt-10 text-sm text-text-secondary">
          <Link href="/" className="text-brand-gold hover:underline">
            Cullinos home
          </Link>
          {' · '}
          <Link href="/features" className="text-brand-gold hover:underline">
            All features
          </Link>
          {related ? (
            <>
              {' · Related: '}
              <Link href={`/features/${related.slug}`} className="text-brand-gold hover:underline">
                {related.name}
              </Link>
            </>
          ) : null}
        </p>
      </Section>
      <CTABanner
        title="See Cullinos in your restaurant"
        description="Talk to the Cullinos team about your outlet, anywhere in India."
        primaryLabel="Talk to us"
        primaryHref="/contact"
        secondaryLabel="All features"
        secondaryHref="/features"
      />
    </>
  );
}
