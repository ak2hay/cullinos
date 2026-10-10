import { useEffect, useState } from 'react';
import { cn } from '@cullinos/ui';

const TINTS = [
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200',
];

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function EntityAvatar({
  name,
  src,
  size = 36,
  seed,
  rounded = 'lg',
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  /** Stable key for the tint (defaults to name). */
  seed?: string;
  rounded?: 'lg' | 'full';
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const radius = rounded === 'full' ? 'rounded-full' : 'rounded-lg';
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setBroken(true)}
        className={cn('shrink-0 object-cover', radius, className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold',
        radius,
        TINTS[hash(seed ?? name) % TINTS.length],
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials(name).slice(0, rounded === 'full' ? 2 : 1)}
    </span>
  );
}
