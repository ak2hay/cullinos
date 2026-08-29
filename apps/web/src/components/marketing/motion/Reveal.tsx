'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { defaultTransition, fadeUp, reducedMotionTransition } from './motionVariants';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'article';
}

export function Reveal({ children, className, delay = 0, as = 'div' }: RevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={fadeUp}
      transition={{
        ...(prefersReducedMotion ? reducedMotionTransition : defaultTransition),
        delay: prefersReducedMotion ? 0 : delay,
      }}
    >
      {children}
    </Component>
  );
}
