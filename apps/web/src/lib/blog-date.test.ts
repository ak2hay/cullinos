import { describe, expect, it } from 'vitest';
import { formatBlogDate, normalizeBlogDate } from './blog-date';

describe('blog dates', () => {
  it('formats a Date object from frontmatter instead of Date.toString()', () => {
    const raw = new Date('2026-08-29T00:00:00.000Z');
    expect(String(raw)).toContain('GMT');
    expect(normalizeBlogDate(raw)).toBe('2026-08-29');
    expect(formatBlogDate(raw)).toBe('29 Aug 2026');
  });

  it('formats an ISO string and the raw Date string the bug used to render', () => {
    expect(formatBlogDate('2026-08-29')).toBe('29 Aug 2026');
    expect(formatBlogDate('Sat Aug 29 2026 00:00:00 GMT+0000 (Coordinated Universal Time)')).toBe(
      '29 Aug 2026',
    );
  });

  it('returns an empty string for missing dates', () => {
    expect(formatBlogDate('')).toBe('');
    expect(formatBlogDate(undefined)).toBe('');
  });
});
