import Link from 'next/link';
import { APP_SHOWCASE_ITEMS } from '@cullinos/shared';
import { MarketingImage } from '@/components/marketing/MarketingImage';

export function AllAppsShowcase() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <div className="mb-12 max-w-2xl">
        <h2 className="font-serif text-3xl font-medium md:text-4xl">Every app your team needs</h2>
        <p className="mt-3 text-text-secondary">
          Six purpose-built apps — one login, one menu, one order system. No more juggling separate tools.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {APP_SHOWCASE_ITEMS.map((app) => (
          <Link
            key={app.title}
            href={app.href}
            className="group overflow-hidden rounded-2xl border border-border-light bg-bg-card shadow-card transition hover:shadow-soft"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-bg-dark">
              <MarketingImage
                imageKey={app.imageKey}
                alt={app.title}
                fill
                className="object-cover object-top transition group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
            <div className="p-5">
              <h3 className="font-serif text-lg font-medium group-hover:text-brand-gold">{app.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{app.benefit}</p>
              <span className="mt-3 inline-block text-xs font-medium tracking-wide text-brand-gold uppercase">
                Learn more →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
