'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { defaultTransition, fadeUp, reducedMotionTransition, staggerContainer } from './motionVariants';

interface StaggerProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'section';
}

export function Stagger({ children, className, as = 'div' }: StaggerProps) {
  const prefersReducedMotion = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={staggerContainer}
    >
      {children}
    </Component>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'article';
}

export function StaggerItem({ children, className, as = 'div' }: StaggerItemProps) {
  const prefersReducedMotion = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      variants={fadeUp}
      transition={prefersReducedMotion ? reducedMotionTransition : defaultTransition}
    >
      {children}
    </Component>
  );
}
