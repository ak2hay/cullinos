import { describe, expect, it } from 'vitest';
import { DEFAULT_TRIAL_DAYS, resolveTrialDays, trialEndDate } from './trial';

describe('trial length', () => {
  it('defaults new tenants to 30 days', () => {
    expect(DEFAULT_TRIAL_DAYS).toBe(30);
    expect(resolveTrialDays()).toBe(30);
    expect(resolveTrialDays(null)).toBe(30);
    expect(resolveTrialDays(0)).toBe(30);
    expect(resolveTrialDays(-5)).toBe(30);
  });

  it('keeps an explicit override and does not invent an end date for an existing row', () => {
    expect(resolveTrialDays(15)).toBe(15);
    const start = new Date('2026-01-01T00:00:00.000Z');
    expect(trialEndDate(start, resolveTrialDays()).toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(trialEndDate(start, 15).toISOString()).toBe('2026-01-16T00:00:00.000Z');
  });
});
