import { useEffect, useState } from 'react';

/**
 * Keeps an element mounted for `exitMs` after `open` turns false so it can play
 * an exit animation. `state` is 'open' | 'closing' while mounted.
 */
export function usePresence(open: boolean, exitMs = 180) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setMounted(false), reduced ? 0 : exitMs);
    return () => window.clearTimeout(t);
  }, [open, mounted, exitMs]);

  return { mounted: open || mounted, state: open ? ('open' as const) : ('closing' as const) };
}
