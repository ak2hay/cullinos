import Link from 'next/link';
import type { ReactNode } from 'react';

type ButtonVariant = 'outline' | 'filled' | 'gold' | 'inverse';

interface MarketingButtonProps {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  external?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  outline: 'btn-pill',
  filled: 'btn-pill-filled btn-pill',
  gold: 'btn-pill-gold btn-pill',
  inverse: 'btn-pill border-white text-white hover:bg-white hover:text-bg-dark',
};

export function MarketingButton({
  href,
  children,
  variant = 'outline',
  className = '',
  external,
}: MarketingButtonProps) {
  const classes = `${variantClasses[variant]} ${className}`.trim();

  if (external || href.startsWith('http') || href.startsWith('mailto:')) {
    return (
      <a href={href} className={classes} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
