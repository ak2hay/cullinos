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
          className="rounded-xl border border-white/5 bg-bg-card p-6 transition hover:border-brand-primary/30"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 font-mono text-lg text-brand-primary">
            {icons[item.icon] ?? '•'}
          </div>
          <h3 className="text-lg font-semibold">{item.title}</h3>
          <p className="mt-2 text-sm text-text-secondary">{item.description}</p>
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
    <div className="space-y-16">
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="mb-6 text-xl font-semibold text-brand-primary">{section.title}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.items.map((item) => (
              <article
                key={item.name}
                className="rounded-xl border border-white/5 bg-bg-secondary p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-semibold">{item.name}</h4>
                  {item.status === 'coming_soon' && (
                    <span className="shrink-0 rounded-full bg-status-warning/10 px-2 py-0.5 text-xs text-status-warning">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-text-secondary">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
