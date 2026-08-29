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
      <div className="mx-auto max-w-6xl px-6">
        {eyebrow && (
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-brand-primary">
            {eyebrow}
          </p>
        )}
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-semibold md:text-4xl">{title}</h2>
          {description && <p className="mt-4 text-text-secondary">{description}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
