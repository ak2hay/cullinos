import { cn } from '@cullinos/ui';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-lg border border-line bg-bg-card p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm transition-colors',
            value === o.value ? 'bg-accent/10 font-medium text-accent' : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
