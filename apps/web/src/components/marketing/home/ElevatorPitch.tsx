import { CULLINOS_ELEVATOR_PITCH } from '@cullinos/shared';

const icons: Record<string, string> = {
  platform: '◎',
  channels: '⇄',
  india: 'IN',
};

export function ElevatorPitch() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-serif text-3xl font-medium md:text-4xl">{CULLINOS_ELEVATOR_PITCH.headline}</h2>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          {CULLINOS_ELEVATOR_PITCH.subline}
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {CULLINOS_ELEVATOR_PITCH.bullets.map((bullet) => (
          <article
            key={bullet.title}
            className="rounded-2xl border border-border-light bg-bg-card p-6 text-center shadow-card"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary text-xl">
              {icons[bullet.icon] ?? '•'}
            </div>
            <h3 className="font-serif text-lg font-medium">{bullet.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{bullet.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
