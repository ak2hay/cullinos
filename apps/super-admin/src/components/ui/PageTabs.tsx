import { cn } from '@cullinos/ui';

export type PageTab<T extends string = string> = { id: T; label: string; count?: number | null };

export function PageTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: PageTab<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto border-b border-line-subtle', className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors',
              active ? 'border-accent font-medium text-accent' : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {t.label}
            {t.count != null ? (
              <span className={cn('rounded-md px-1.5 text-xs leading-5', active ? 'bg-accent/12' : 'bg-bg-elevated text-text-muted')}>{t.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function DefinitionList({ items, columns = 2 }: { items: Array<{ label: string; value: React.ReactNode }>; columns?: 2 | 3 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4 text-sm', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium text-text-muted">{i.label}</dt>
          <dd className="mt-1 break-words text-text-primary">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
