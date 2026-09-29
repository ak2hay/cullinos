import {
  MARKETING_THEME_TOKEN_CSS_VARS,
  sanitizeThemeCssValue,
  type MarketingCmsBundle,
} from '@cullinos/shared';

export { sanitizeThemeCssValue };

export function MarketingThemeStyles({ theme }: { theme: Record<string, string> }) {
  if (!theme || Object.keys(theme).length === 0) return null;

  const rules = Object.entries(theme)
    .filter(([key, value]) => MARKETING_THEME_TOKEN_CSS_VARS[key] && value)
    .map(([key, value]) => {
      const safe = sanitizeThemeCssValue(value);
      if (!safe) return null;
      return `${MARKETING_THEME_TOKEN_CSS_VARS[key]}: ${safe};`;
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
