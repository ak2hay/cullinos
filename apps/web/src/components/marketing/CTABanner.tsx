import Link from 'next/link';
import { getRegisterUrl } from '@/lib/urls';

interface CTABannerProps {
  title?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export function CTABanner({
  title = 'Ready to run your restaurant from one place?',
  description = 'Start your free trial or talk to our team about Enterprise and Hospitality plans.',
  primaryLabel = 'Start free trial',
  primaryHref = getRegisterUrl(),
  secondaryLabel = 'Contact sales',
  secondaryHref = '/contact',
}: CTABannerProps) {
  return (
    <section className="border-y border-white/5 bg-bg-secondary">
      <div className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h2 className="text-3xl font-semibold md:text-4xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-text-secondary">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href={primaryHref}
            className="rounded-lg bg-brand-primary px-6 py-3 text-sm font-medium text-bg-primary transition hover:bg-brand-primary-dark"
          >
            {primaryLabel}
          </Link>
          <Link
            href={secondaryHref}
            className="rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-text-primary transition hover:border-brand-primary/50"
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
