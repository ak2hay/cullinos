interface PlaceholderPageProps {
  title: string;
  phase: string;
}

export function PlaceholderPage({ title, phase }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="rounded-xl border border-white/5 bg-bg-card px-8 py-12">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-text-secondary">
          This module is planned for {phase}.
        </p>
        <span className="mt-4 inline-block rounded-full bg-brand-primary/15 px-3 py-1 text-sm text-brand-primary">
          Coming soon
        </span>
      </div>
    </div>
  );
}
