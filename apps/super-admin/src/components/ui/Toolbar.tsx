import type { ReactNode, SelectHTMLAttributes } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@cullinos/ui';

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  onSubmit,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onSubmit?: () => void;
  label?: string;
}) {
  return (
    <label className={cn('relative block w-full sm:w-64', className)}>
      <span className="sr-only">{label ?? placeholder}</span>
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
      />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className="h-9 w-full rounded-lg border border-line bg-bg-card pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </label>
  );
}

export type FilterOption = { value: string; label: string };

export function FilterSelect({
  options,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: FilterOption[] }) {
  return (
    <span className={cn('relative inline-block', className)}>
      <select
        {...props}
        className="h-9 w-full appearance-none rounded-lg border border-line bg-bg-card pl-3 pr-8 text-sm text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
      />
    </span>
  );
}
