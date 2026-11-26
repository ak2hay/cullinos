import type { ReactNode } from 'react';

interface StaggerProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'section';
}

export function Stagger({ children, className, as = 'div' }: StaggerProps) {
  const Tag = as;
  return <Tag className={className}>{children}</Tag>;
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'article';
}

export function StaggerItem({ children, className, as = 'div' }: StaggerItemProps) {
  const Tag = as;
  return <Tag className={className}>{children}</Tag>;
}
