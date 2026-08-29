'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { FEATURE_CATEGORIES } from '@cullinos/shared';
import { MarketingImage } from '@/components/marketing/MarketingImage';
import { Reveal } from '@/components/marketing/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/marketing/motion/Stagger';
import { MarketingCard } from '@/components/marketing/MarketingCard';

export function FeatureMatrix() {
  return (
    <section className="border-y border-border-light bg-bg-secondary py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-serif text-3xl font-medium md:text-4xl">Everything included</h2>
            <p className="mt-3 max-w-xl text-text-secondary">
              A complete feature set for running your restaurant — from billing to enterprise analytics.
            </p>
          </div>
          <Link href="/features" className="btn-pill shrink-0">
            See full details
          </Link>
        </Reveal>

        <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURE_CATEGORIES.map((category) => (
            <StaggerItem key={category.id} as="article">
              <MarketingCard id={category.id} className="overflow-hidden p-0">
                <div className="relative aspect-[16/9] border-b border-border-light bg-bg-elevated">
                  <MarketingImage
                    imageKey={category.imageKey}
                    alt={category.title}
                    fill
                    className="object-contain p-2"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-serif text-lg font-medium capitalize">{category.title}</h3>
                  {category.benefit && (
                    <p className="mt-1 text-xs text-text-muted">{category.benefit}</p>
                  )}
                  <ul className="mt-4 space-y-2">
                    {category.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-success" strokeWidth={2} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </MarketingCard>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
