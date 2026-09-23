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
});
