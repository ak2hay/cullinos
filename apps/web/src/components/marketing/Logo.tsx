import Link from 'next/link';
import { CULLINOS_BRAND } from '@cullinos/shared';

interface LogoProps {
  showTagline?: boolean;
  size?: 'sm' | 'md';
  variant?: 'full' | 'icon';
}

export function Logo({ showTagline = false, size = 'md', variant = 'full' }: LogoProps) {
  const iconSize = size === 'sm' ? 'h-9 w-9 text-sm' : 'h-11 w-11 text-base';

  if (variant === 'icon') {
    return (
      <Link href="/" aria-label={CULLINOS_BRAND.name}>
        <div
          className={`flex ${iconSize} items-center justify-center rounded-full border-2 border-brand-gold bg-bg-card font-serif font-semibold text-brand-gold shadow-card`}
        >
          C
        </div>
      </Link>
    );
  }

  return (
    <Link href="/" className="flex items-center gap-3">
      <div
        className={`flex ${iconSize} items-center justify-center rounded-full border-2 border-brand-gold bg-bg-card font-serif font-semibold text-brand-gold shadow-card`}
      >
        C
      </div>
      {showTagline && (
        <div>
          <p className="font-serif text-lg font-medium">{CULLINOS_BRAND.name}</p>
          <p className="text-xs tracking-wide text-text-muted">{CULLINOS_BRAND.tagline}</p>
        </div>
      )}
    </Link>
  );
}
