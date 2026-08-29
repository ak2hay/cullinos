import Image from 'next/image';
import { HOW_IT_WORKS_STEPS } from '@cullinos/shared';
import { getMarketingImage } from '@/lib/images';

const stepIcons: Record<string, string> = {
  setup: '1',
  orders: '2',
  kitchen: '3',
  grow: '4',
};

export function HowItWorks() {
  return (
    <section className="border-y border-border-light bg-bg-elevated py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-12 text-center">
          <h2 className="font-serif text-3xl font-medium md:text-4xl">How Cullinos works</h2>
          <p className="mt-3 text-text-secondary">
            Four simple steps from setup to growing your restaurant business.
          </p>
        </div>

        <div className="mb-12 hidden md:block">
          <Image
            src={getMarketingImage('flowCloud')}
            alt="Cullinos cloud flow diagram"
            width={600}
            height={200}
            className="mx-auto w-full max-w-3xl"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <article key={step.step} className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-card">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-bg-dark font-serif text-sm font-medium text-brand-gold">
                {stepIcons[step.icon] ?? step.step}
              </div>
              <h3 className="font-serif text-lg font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
