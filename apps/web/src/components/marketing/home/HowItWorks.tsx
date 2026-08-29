'use client';

import { HOW_IT_WORKS_STEPS } from '@cullinos/shared';
import { MarketingImage } from '@/components/marketing/MarketingImage';
import { Reveal } from '@/components/marketing/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/marketing/motion/Stagger';
import { MarketingCard } from '@/components/marketing/MarketingCard';

export function HowItWorks() {
  return (
    <section className="border-y border-border-light bg-bg-elevated py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mb-12 text-center">
          <h2 className="font-serif text-3xl font-medium md:text-4xl">How Cullinos works</h2>
          <p className="mt-3 text-text-secondary">
            Four simple steps from setup to growing your restaurant business.
          </p>
        </Reveal>

        <Reveal className="mb-12">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border-light bg-bg-card p-4 shadow-card">
            <MarketingImage
              imageKey="flowCloud"
              alt="Cullinos cloud flow diagram"
              width={600}
              height={200}
              className="mx-auto w-full"
            />
          </div>
        </Reveal>

        <Stagger className="relative hidden gap-6 sm:grid-cols-2 md:grid lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <StaggerItem key={step.step} as="article">
              <MarketingCard className="relative p-6">
                {index < HOW_IT_WORKS_STEPS.length - 1 && (
                  <span className="absolute top-1/2 -right-3 hidden h-px w-6 bg-brand-gold/40 lg:block" aria-hidden />
                )}
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-bg-dark font-serif text-sm font-medium text-brand-gold">
                  {step.step}
                </div>
                <h3 className="font-serif text-lg font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.description}</p>
              </MarketingCard>
            </StaggerItem>
          ))}
        </Stagger>

        <div className="mt-8 md:hidden">
          <div className="relative ml-5 border-l-2 border-brand-gold/30 pl-8">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div key={step.step} className="relative pb-8 last:pb-0">
                <span className="absolute -left-[2.55rem] flex h-8 w-8 items-center justify-center rounded-full bg-bg-dark text-xs font-medium text-brand-gold">
                  {step.step}
                </span>
                <h3 className="font-serif text-base font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
