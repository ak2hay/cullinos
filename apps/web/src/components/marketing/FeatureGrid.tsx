import { FEATURE_CATEGORY_IDS, FEATURE_CATEGORY_IMAGES, type MarketingImageKey } from '@cullinos/shared';
import { MarketingImage } from '@/components/marketing/MarketingImage';

const icons: Record<string, string> = {
  pos: '₹',
  kds: '◫',
  waiter: '☰',
  ordering: '⎘',
  admin: '▦',
  enterprise: '◎',
};

interface ProductModule {
  title: string;
  description: string;
  icon: string;
}

export function FeatureGrid({ items }: { items: readonly ProductModule[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.title}
          className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-card transition hover:shadow-soft"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-bg-secondary font-serif text-lg text-brand-gold">
            {icons[item.icon] ?? '•'}
          </div>
          <h3 className="font-serif text-lg font-medium">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.description}</p>
        </article>
      ))}
    </div>
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
          <div key={section.title} id={sectionId} className="scroll-mt-24">
            <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div>
                <h3 className="font-serif text-2xl font-medium capitalize text-brand-gold">{section.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  {section.items[0]?.description}
                </p>
              </div>
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border-light bg-bg-dark shadow-card">
                <MarketingImage
                  imageKey={imageKey}
                  alt={`${section.title} module`}
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {section.items.map((item) => (
                <article
                  key={item.name}
                  className="rounded-2xl border border-border-light bg-bg-card p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-medium">{item.name}</h4>
                    {item.status === 'coming_soon' && (
                      <span className="shrink-0 rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-brand-gold">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
