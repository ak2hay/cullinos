import { useEffect, useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Must match `public/theme-boot.js` in each app. */
export const THEME_STORAGE_KEY = 'cullinos-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

let currentMode: ThemeMode = readStoredMode();

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? systemTheme() : mode;
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function applyTheme(theme: ResolvedTheme, animate: boolean) {
  const root = document.documentElement;
  if (root.dataset.themeLock) return;
  if (root.getAttribute('data-theme') === theme) return;

  const commit = () => {
    root.setAttribute('data-theme', theme);
    emit();
  };
  if (!animate || prefersReducedMotion()) {
    commit();
    return;
  }

  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(commit);
    return;
  }

  root.classList.add('theme-transition');
  commit();
  window.setTimeout(() => root.classList.remove('theme-transition'), 260);
}

function emit() {
  for (const listener of listeners) listener();
}

export function getThemeMode(): ThemeMode {
  return currentMode;
}

export function setThemeMode(mode: ThemeMode) {
  currentMode = mode;
  try {
    if (mode === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* storage unavailable (private mode) — keep in-memory preference */
  }
  applyTheme(resolveTheme(mode), true);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.matchMedia?.(DARK_QUERY).addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.matchMedia?.(DARK_QUERY).removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    }
  };
}

function onSystemChange() {
  if (currentMode !== 'system') return;
  applyTheme(systemTheme(), true);
  emit();
}

function onStorage(event: StorageEvent) {
  if (event.key !== THEME_STORAGE_KEY) return;
  currentMode = readStoredMode();
  applyTheme(resolveTheme(currentMode), true);
  emit();
}

function snapshot() {
  return `${currentMode}:${resolveTheme(currentMode)}`;
}

export function useThemeMode() {
  const value = useSyncExternalStore(subscribe, snapshot, () => 'system:dark');
  const [mode, resolved] = value.split(':') as [ThemeMode, ResolvedTheme];
  return { mode, resolved, setMode: setThemeMode };
}

/** Pins a screen (e.g. customer-facing displays) to one theme while mounted. */
export function useLockedTheme(theme: ResolvedTheme) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    root.setAttribute('data-theme', theme);
    root.dataset.themeLock = theme;
    return () => {
      delete root.dataset.themeLock;
      root.setAttribute('data-theme', previous ?? resolveTheme(currentMode));
    };
  }, [theme]);
}

function readCssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Reads a CSS custom property, re-evaluated whenever the theme changes. */
export function useCssVar(name: string, fallback = ''): string {
  return useSyncExternalStore(subscribe, () => readCssVar(name, fallback), () => fallback);
}
