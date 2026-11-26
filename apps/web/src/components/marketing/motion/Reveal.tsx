import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'article';
}

/** Static wrapper. Entrance motion was removed so the first paint matches the final layout. */
export function Reveal({ children, className, as = 'div' }: RevealProps) {
  const Tag = as;
  return <Tag className={className}>{children}</Tag>;
}
