import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLE_PERMISSIONS } from '@cullinos/shared';
import { isJobNavVisible } from './navAccess';

describe('isJobNavVisible', () => {
  it('shows owners every job, including advanced pages', () => {
    const owner = DEFAULT_ROLE_PERMISSIONS.OWNER;
    expect(isJobNavVisible(owner, '/events')).toBe(true);
    expect(isJobNavVisible(owner, '/marketplace')).toBe(true);
  });

  it('shows kitchen the ticket screens and hides events', () => {
    const chef = DEFAULT_ROLE_PERMISSIONS.CHEF;
    expect(isJobNavVisible(chef, '/displays')).toBe(true);
    expect(isJobNavVisible(chef, '/stations')).toBe(true);
    expect(isJobNavVisible(chef, '/events')).toBe(false);
    expect(isJobNavVisible(chef, '/marketplace')).toBe(false);
  });

  it('keeps day-to-day pages for managers', () => {
    const manager = DEFAULT_ROLE_PERMISSIONS.MANAGER;
    expect(isJobNavVisible(manager, '/tables')).toBe(true);
    expect(isJobNavVisible(manager, '/displays')).toBe(true);
    expect(isJobNavVisible(manager, '/kiosk')).toBe(true);
    expect(isJobNavVisible(manager, '/events')).toBe(true);
  });
});
