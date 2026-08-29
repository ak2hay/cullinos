'use client';

import { CULLINOS_ELEVATOR_PITCH } from '@cullinos/shared';
import { IndianRupee, Layers, Smartphone } from 'lucide-react';
import { Reveal } from '@/components/marketing/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/marketing/motion/Stagger';
import { MarketingCard } from '@/components/marketing/MarketingCard';

const iconMap = {
  platform: Layers,
  channels: Smartphone,
  india: IndianRupee,
} as const;

export function ElevatorPitch() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <Reveal className="mx-auto max-w-3xl text-center">
        <h2 className="font-serif text-3xl font-medium md:text-4xl">{CULLINOS_ELEVATOR_PITCH.headline}</h2>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          {CULLINOS_ELEVATOR_PITCH.subline}
        </p>
      </Reveal>
      <Stagger className="mt-12 grid gap-6 md:grid-cols-3">
        {CULLINOS_ELEVATOR_PITCH.bullets.map((bullet) => {
          const Icon = iconMap[bullet.icon as keyof typeof iconMap] ?? Layers;
          return (
            <StaggerItem key={bullet.title}>
              <MarketingCard className="p-6 text-center transition-colors hover:border-brand-gold/40">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary text-brand-gold">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-lg font-medium">{bullet.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{bullet.description}</p>
              </MarketingCard>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
