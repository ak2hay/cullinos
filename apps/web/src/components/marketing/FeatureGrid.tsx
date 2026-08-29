'use client';

import { FEATURE_CATEGORY_IDS, FEATURE_CATEGORY_IMAGES, type MarketingImageKey } from '@cullinos/shared';
import { MarketingImage } from '@/components/marketing/MarketingImage';
import { Reveal } from '@/components/marketing/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/marketing/motion/Stagger';
import { MarketingCard } from '@/components/marketing/MarketingCard';

interface ProductModule {
  title: string;
  description: string;
  icon: string;
}

export function FeatureGrid({ items }: { items: readonly ProductModule[] }) {
  return (
    <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <StaggerItem key={item.title}>
          <MarketingCard className="p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-bg-secondary font-serif text-lg text-brand-gold">
              {item.title.charAt(0)}
            </div>
            <h3 className="font-serif text-lg font-medium">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.description}</p>
          </MarketingCard>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

interface FeatureItem {
  name: string;
  description: string;
  status: 'available' | 'coming_soon';
}

interface FeatureSection {
  title: string;
  items: readonly FeatureItem[];
}

export function FeatureSections({ sections }: { sections: readonly FeatureSection[] }) {
  return (
    <div className="space-y-20">
      {sections.map((section) => {
        const sectionId = FEATURE_CATEGORY_IDS[section.title] ?? section.title.toLowerCase().replace(/\s+/g, '-');
        const imageKey = (FEATURE_CATEGORY_IMAGES[section.title] ?? 'mockupAdmin') as MarketingImageKey;

        return (
          <Reveal key={section.title} as="section">
            <div id={sectionId} className="scroll-mt-24">
              <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
                <div>
                  <h3 className="font-serif text-2xl font-medium capitalize text-brand-gold">{section.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary">
                    {section.items[0]?.description}
                  </p>
                </div>
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border-light bg-bg-elevated shadow-card">
                  <MarketingImage
                    imageKey={imageKey}
                    alt={`${section.title} module`}
                    fill
                    className="object-contain p-3"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </div>
              <Stagger className="grid gap-4 sm:grid-cols-2">
                {section.items.map((item) => (
                  <StaggerItem key={item.name}>
                    <MarketingCard className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-medium">{item.name}</h4>
                        {item.status === 'coming_soon' && (
                          <span className="shrink-0 rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-brand-gold">
                            Coming soon
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.description}</p>
                    </MarketingCard>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
