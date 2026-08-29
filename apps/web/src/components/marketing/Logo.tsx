import Link from 'next/link';
import { CULLINOS_BRAND } from '@cullinos/shared';

interface LogoProps {
  showTagline?: boolean;
  size?: 'sm' | 'md';
}

export function Logo({ showTagline = false, size = 'md' }: LogoProps) {
  const boxSize = size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-lg';

  return (
    <Link href="/" className="flex items-center gap-3">
      <div
        className={`flex ${boxSize} items-center justify-center rounded-lg bg-brand-primary font-mono font-bold text-bg-primary`}
      >
        C
      </div>
      <div>
        <p className={size === 'sm' ? 'text-base font-semibold' : 'text-xl font-semibold'}>
          {CULLINOS_BRAND.name}
        </p>
        {showTagline && (
          <p className="text-xs text-text-secondary">{CULLINOS_BRAND.tagline}</p>
        )}
      </div>
    </Link>
  );
}
