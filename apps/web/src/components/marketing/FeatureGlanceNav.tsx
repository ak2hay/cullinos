'use client';

import Link from 'next/link';
import { FEATURE_CATEGORIES } from '@cullinos/shared';

export function FeatureGlanceNav() {
  return (
    <nav className="mb-12 flex flex-wrap gap-2">
      {FEATURE_CATEGORIES.map((category) => (
        <Link
          key={category.id}
          href={`#${category.id}`}
          className="rounded-full border border-border-light bg-bg-card px-4 py-2 text-xs font-medium tracking-wide text-text-secondary uppercase transition hover:border-brand-gold hover:text-text-primary"
        >
          {category.title}
        </Link>
      ))}
    </nav>
  );
}
