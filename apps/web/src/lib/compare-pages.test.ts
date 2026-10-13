import { describe, expect, it } from 'vitest';
import { COMPARE_PAGES } from './compare-pages';

describe('compare pages', () => {
  it('make no claims about competitor price, quality or ratings', () => {
    const text = JSON.stringify(COMPARE_PAGES).toLowerCase();
    for (const banned of ['₹', 'cheaper', 'expensive', 'better than', 'worse', 'rating', 'review score', 'lacks', 'missing']) {
      expect(text).not.toContain(banned);
    }
  });

  it('every page names a competitor with an official link and has FAQs', () => {
    for (const page of COMPARE_PAGES) {
      expect(page.competitors.length).toBeGreaterThan(0);
      for (const c of page.competitors) expect(c.url).toMatch(/^https:\/\//);
      expect(page.faqs.length).toBeGreaterThanOrEqual(3);
    }
  });
});
