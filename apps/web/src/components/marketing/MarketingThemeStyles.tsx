import type { MarketingCmsBundle } from '@cullinos/shared';

const TOKEN_CSS_MAP: Record<string, string> = {
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

/** Allow only safe CSS color / length-like token values (no url(), expression, etc.). */
export function sanitizeThemeCssValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return null;
  if (/[;{}]|url\s*\(|expression\s*\(|@import|javascript:/i.test(trimmed)) {
    return null;
  }
  // Hex, rgb/rgba/hsl/hsla, named colors, and simple lengths/keywords.
  if (
    /^#([0-9a-fA-F]{3,8})$/.test(trimmed) ||
    /^(rgb|rgba|hsl|hsla)\([^)]+\)$/i.test(trimmed) ||
    /^[a-zA-Z][a-zA-Z0-9-]*$/.test(trimmed) ||
    /^\d+(\.\d+)?(px|rem|em|%|vh|vw)?$/.test(trimmed)
  ) {
    return trimmed;
  }
  return null;
}

export function MarketingThemeStyles({ theme }: { theme: Record<string, string> }) {
  if (!theme || Object.keys(theme).length === 0) return null;

  const rules = Object.entries(theme)
    .filter(([key, value]) => TOKEN_CSS_MAP[key] && value)
    .map(([key, value]) => {
      const safe = sanitizeThemeCssValue(value);
      if (!safe) return null;
      return `${TOKEN_CSS_MAP[key]}: ${safe};`;
    })
    .filter(Boolean)
    .join('\n  ');

  if (!rules) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root {\n  ${rules}\n}`,
      }}
    />
  );
}

export function hasCmsTheme(theme: MarketingCmsBundle['theme']) {
  return theme && Object.keys(theme).length > 0;
}
