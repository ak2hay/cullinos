import { TRUST_PILLARS } from '@cullinos/shared';

const icons = ['₹', '⚡', '◎'];

export function IndiaDifferentiators() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <div className="mb-10 text-center">
        <h2 className="font-serif text-3xl font-medium md:text-4xl">Built for Indian restaurants</h2>
        <p className="mt-3 text-text-secondary">
          Local compliance and reliability out of the box — not bolted on later.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {TRUST_PILLARS.map((pillar, i) => (
          <article
            key={pillar.title}
            className="rounded-2xl border border-border-light bg-bg-card p-8 text-center shadow-card"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-bg-secondary text-2xl">
              {icons[i] ?? '•'}
            </div>
            <h3 className="font-serif text-lg font-medium">{pillar.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{pillar.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
