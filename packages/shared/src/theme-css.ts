export const MARKETING_THEME_TOKEN_CSS_VARS: Record<string, string> = {
  brandPrimary: '--color-brand-primary',
  brandPrimaryDark: '--color-brand-primary-dark',
  brandGold: '--color-brand-gold',
  brandSecondary: '--color-brand-secondary',
  brandAccent: '--color-brand-accent',
  bgPrimary: '--color-bg-primary',
  bgSecondary: '--color-bg-secondary',
  bgCard: '--color-bg-card',
  bgElevated: '--color-bg-elevated',
  bgDark: '--color-bg-dark',
  textPrimary: '--color-text-primary',
  textSecondary: '--color-text-secondary',
  textMuted: '--color-text-muted',
  textInverse: '--color-text-inverse',
  border: '--color-border',
  borderLight: '--color-border-light',
};

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_FN = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.%\s,/-]+\)$/i;
const KEYWORD = /^[a-zA-Z][a-zA-Z-]{0,31}$/;
const LENGTH = /^\d{1,4}(?:\.\d{1,3})?(?:px|rem|em|%|vh|vw)?$/;

/**
 * Only hex, numeric rgb/hsl(), bare keywords and simple lengths are allowed, so
 * a value can never break out of the declaration or the surrounding <style>.
 */
export function sanitizeThemeCssValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return null;
  if (HEX.test(trimmed) || COLOR_FN.test(trimmed) || KEYWORD.test(trimmed) || LENGTH.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/** Returns the invalid token keys (unknown key or unsafe value). */
export function invalidThemeTokens(tokens: Record<string, unknown>): string[] {
  return Object.entries(tokens)
    .filter(([key, value]) => !MARKETING_THEME_TOKEN_CSS_VARS[key] || sanitizeThemeCssValue(value) === null)
    .map(([key]) => key);
}
