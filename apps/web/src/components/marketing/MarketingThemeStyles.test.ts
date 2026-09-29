import { describe, expect, it } from 'vitest';
import { sanitizeThemeCssValue } from './MarketingThemeStyles';

describe('sanitizeThemeCssValue', () => {
  it('allows hex colors', () => {
    expect(sanitizeThemeCssValue('#0a1b2c')).toBe('#0a1b2c');
  });

  it('rejects url() and expression()', () => {
    expect(sanitizeThemeCssValue('url(https://evil.test)')).toBeNull();
    expect(sanitizeThemeCssValue('expression(alert(1))')).toBeNull();
  });

  it('rejects semicolon injection', () => {
    expect(sanitizeThemeCssValue('red; background:url(x)')).toBeNull();
  });

  it('allows numeric color functions only', () => {
    expect(sanitizeThemeCssValue('rgba(10, 20, 30, 0.5)')).toBe('rgba(10, 20, 30, 0.5)');
    expect(sanitizeThemeCssValue('hsl(40 90% 50% / 0.8)')).toBe('hsl(40 90% 50% / 0.8)');
    expect(sanitizeThemeCssValue('rgb(</style><img src=x onerror=alert`1`>)')).toBeNull();
  });

  it('rejects style-tag breakout', () => {
    expect(sanitizeThemeCssValue('</style><script>alert(1)</script>')).toBeNull();
  });
});
