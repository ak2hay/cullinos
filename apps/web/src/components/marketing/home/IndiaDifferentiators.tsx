'use client';

import { Shield, Wifi, Zap } from 'lucide-react';
import { TRUST_PILLARS } from '@cullinos/shared';
import { Reveal } from '@/components/marketing/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/marketing/motion/Stagger';
import { MarketingCard } from '@/components/marketing/MarketingCard';

const icons = [Shield, Zap, Wifi];

export function IndiaDifferentiators() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <Reveal className="mb-10 text-center">
        <h2 className="font-serif text-3xl font-medium md:text-4xl">Built for Indian restaurants</h2>
        <p className="mt-3 text-text-secondary">
          Local compliance and reliability out of the box — not bolted on later.
        </p>
      </Reveal>
      <Stagger className="grid gap-6 md:grid-cols-3">
        {TRUST_PILLARS.map((pillar, i) => {
          const Icon = icons[i] ?? Shield;
          return (
            <StaggerItem key={pillar.title}>
              <MarketingCard className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-bg-secondary text-brand-gold">
                  <Icon className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-lg font-medium">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{pillar.description}</p>
              </MarketingCard>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
