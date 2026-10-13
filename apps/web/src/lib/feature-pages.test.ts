import { describe, expect, it } from 'vitest';
import { FEATURE_PAGES, FEATURE_PAGE_SLUGS, featurePageWordCount, getFeaturePage } from './feature-pages';

describe('feature pages', () => {
  it('ships exactly the 5 confirmed slugs', () => {
    expect(FEATURE_PAGE_SLUGS).toEqual([
      'restaurant-pos',
      'kitchen-display-system',
      'qr-ordering',
      'inventory-management',
      'recipe-management',
    ]);
  });

  it.each(FEATURE_PAGES)('$slug has 600+ words, 3-5 FAQs and a live related page', (page) => {
    expect(featurePageWordCount(page)).toBeGreaterThanOrEqual(600);
    expect(page.faqs.length).toBeGreaterThanOrEqual(3);
    expect(page.faqs.length).toBeLessThanOrEqual(5);
    expect(getFeaturePage(page.related)).toBeDefined();
    expect(page.related).not.toBe(page.slug);
  });

  it('titles and descriptions are unique and within SERP limits', () => {
    expect(new Set(FEATURE_PAGES.map((p) => p.title)).size).toBe(FEATURE_PAGES.length);
    for (const p of FEATURE_PAGES) {
      expect(p.title.length).toBeLessThanOrEqual(70);
      expect(p.description.length).toBeLessThanOrEqual(160);
    }
  });

  it('never claims unconfirmed features', () => {
    const text = JSON.stringify(FEATURE_PAGES).toLowerCase();
    for (const banned of ['swiggy', 'zomato', 'aggregator', 'split bill', 'automatic stock', 'auto-deduct']) {
      expect(text).not.toContain(banned);
    }
  });
});
