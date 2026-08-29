'use client';

import Link from 'next/link';
import { Reveal } from '@/components/marketing/motion/Reveal';
import { useMarketingCms } from '@/components/marketing/MarketingCmsProvider';
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
  primaryHref,
  secondaryLabel = 'Contact sales',
  secondaryHref = '/contact',
}: CTABannerProps) {
  const cms = useMarketingCms();
  const resolvedPrimaryHref = primaryHref ?? cms.site?.registerUrl ?? getRegisterUrl();

  return (
    <section className="cta-shimmer border-y border-border-light">
      <Reveal className="mx-auto max-w-7xl px-6 py-16 text-center lg:px-10">
        <h2 className="font-serif text-3xl font-medium md:text-4xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-text-secondary">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href={resolvedPrimaryHref} className="btn-pill-filled btn-pill">
            {primaryLabel}
          </Link>
          <Link href={secondaryHref} className="btn-pill">
            {secondaryLabel}
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
