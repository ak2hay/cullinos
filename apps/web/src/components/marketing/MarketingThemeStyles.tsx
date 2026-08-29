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

export function MarketingThemeStyles({ theme }: { theme: Record<string, string> }) {
  if (!theme || Object.keys(theme).length === 0) return null;

  const rules = Object.entries(theme)
    .filter(([key, value]) => TOKEN_CSS_MAP[key] && value)
    .map(([key, value]) => `${TOKEN_CSS_MAP[key]}: ${value};`)
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
