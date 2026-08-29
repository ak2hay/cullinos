import Link from 'next/link';
import { FEATURE_CATEGORIES } from '@cullinos/shared';

export function FeatureMatrix() {
  return (
    <section className="border-y border-border-light bg-bg-secondary py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-serif text-3xl font-medium md:text-4xl">Everything included</h2>
            <p className="mt-3 max-w-xl text-text-secondary">
              A complete feature set for running your restaurant — from billing to enterprise analytics.
            </p>
          </div>
          <Link href="/features" className="btn-pill shrink-0">
            See full details
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURE_CATEGORIES.map((category) => (
            <article
              key={category.id}
              id={category.id}
              className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-card"
            >
              <h3 className="font-serif text-lg font-medium capitalize">{category.title}</h3>
              <ul className="mt-4 space-y-2">
                {category.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="text-status-success">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
