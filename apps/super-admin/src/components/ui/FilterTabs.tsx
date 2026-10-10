import { cn } from '@cullinos/ui';

export type FilterTab<T extends string = string> = { id: T; label: string; count?: number | null };

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  label = 'Filter',
}: {
  tabs: FilterTab<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex flex-wrap items-center gap-1', className)}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-accent/10 font-medium text-accent'
                : 'text-text-secondary hover:bg-hover hover:text-text-primary',
            )}
          >
            {tab.label}
            {tab.count != null ? (
              <span
                className={cn(
                  'min-w-5 rounded-md px-1.5 text-center text-xs font-semibold leading-5',
                  active ? 'bg-accent/15 text-accent' : 'bg-bg-elevated text-text-secondary',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
