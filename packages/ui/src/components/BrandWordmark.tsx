import { cn } from '../utils';

export interface BrandWordmarkProps {
  className?: string;
  markClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  showMark?: boolean;
}

const sizeClasses = {
  sm: { text: 'text-base', mark: 'h-7 w-7 text-xs' },
  md: { text: 'text-lg', mark: 'h-9 w-9 text-sm' },
  lg: { text: 'text-2xl', mark: 'h-10 w-10 text-base' },
} as const;

/** Shared Cullinos wordmark — gold mark + display type. */
export function BrandWordmark({
  className,
  markClassName,
  size = 'md',
  showMark = true,
}: BrandWordmarkProps) {
  const s = sizeClasses[size];
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {showMark ? (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-lg bg-brand-primary font-display font-extrabold tracking-tight text-bg-primary shadow-sm',
            s.mark,
            markClassName,
          )}
          aria-hidden
        >
          C
        </span>
      ) : null}
      <span className={cn('font-display font-extrabold tracking-tight text-text-primary', s.text)}>
        Cullinos
        <span className="text-brand-primary">.</span>
      </span>
    </span>
  );
}
