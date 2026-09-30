import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useThemeMode, type ThemeMode } from '../theme-mode';
import { cn } from '../utils';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

const OPTIONS: Array<{ mode: ThemeMode; label: string; icon: ReactNode }> = [
  { mode: 'light', label: 'Light', icon: <SunIcon /> },
  { mode: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { mode: 'system', label: 'System', icon: <MonitorIcon /> },
];

export interface ThemeToggleProps {
  /** `segmented` shows all three options inline; `icon` is a compact button with a menu. */
  variant?: 'segmented' | 'icon';
  className?: string;
}

export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { mode, resolved, setMode } = useThemeMode();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (variant === 'segmented') {
    return (
      <div
        role="radiogroup"
        aria-label="Theme"
        className={cn('inline-flex gap-1 rounded-lg border border-line-subtle bg-bg-elevated p-1', className)}
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            role="radio"
            aria-checked={mode === opt.mode}
            onClick={() => setMode(opt.mode)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)]',
              mode === opt.mode
                ? 'bg-bg-card text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={`Theme: ${mode}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-line-subtle text-text-secondary transition-colors duration-[var(--duration-fast)] hover:bg-hover hover:text-text-primary"
      >
        <span
          className={cn(
            'absolute transition-all duration-300 ease-[var(--ease-out)]',
            resolved === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0',
          )}
        >
          <MoonIcon />
        </span>
        <span
          className={cn(
            'absolute transition-all duration-300 ease-[var(--ease-out)]',
            resolved === 'light' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-50 opacity-0',
          )}
        >
          <SunIcon />
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-40 origin-top-right animate-scale-in rounded-xl border border-line bg-bg-secondary p-1 shadow-lg"
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              role="menuitemradio"
              aria-checked={mode === opt.mode}
              onClick={() => {
                setMode(opt.mode);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                mode === opt.mode
                  ? 'bg-brand-primary/15 text-brand-primary'
                  : 'text-text-secondary hover:bg-hover hover:text-text-primary',
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
