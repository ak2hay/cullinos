'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface MarketingCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  as?: 'article' | 'div';
  id?: string;
}

export function MarketingCard({ children, className = '', hover = true, as = 'article', id }: MarketingCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const Component = motion[as];

  const baseClasses =
    'rounded-2xl border border-border-light bg-bg-card shadow-card transition-shadow duration-300';

  if (!hover || prefersReducedMotion) {
    return <Component id={id} className={`${baseClasses} ${className}`.trim()}>{children}</Component>;
  }

  return (
    <Component
      id={id}
      className={`${baseClasses} ${className}`.trim()}
      whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(44, 36, 22, 0.12)' }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Component>
  );
}
