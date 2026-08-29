interface SectionProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function Section({ eyebrow, title, description, children, className = '', id }: SectionProps) {
  return (
    <section id={id} className={`py-16 md:py-20 ${className}`}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {eyebrow && (
          <p className="mb-3 text-xs font-medium tracking-[0.2em] uppercase text-brand-gold">
            {eyebrow}
          </p>
        )}
        <div className="mb-10 max-w-2xl">
          <h2 className="font-serif text-3xl font-medium md:text-4xl">{title}</h2>
          {description && (
            <p className="mt-4 leading-relaxed text-text-secondary">{description}</p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
