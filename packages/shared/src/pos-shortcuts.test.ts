import { describe, expect, it } from 'vitest';
import { findItemByShortCode, matchesPosSearch, posQuickKeySlot } from './pos-shortcuts';

describe('posQuickKeySlot', () => {
  it('maps F1-F12 and Alt+1-9 to slots', () => {
    expect(posQuickKeySlot({ key: 'F1' })).toBe(1);
    expect(posQuickKeySlot({ key: 'F12' })).toBe(12);
    expect(posQuickKeySlot({ key: '3', altKey: true })).toBe(3);
  });

  it('ignores other keys and modified combos', () => {
    expect(posQuickKeySlot({ key: 'F13' })).toBeNull();
    expect(posQuickKeySlot({ key: '3' })).toBeNull();
    expect(posQuickKeySlot({ key: 'F5', ctrlKey: true })).toBeNull();
    expect(posQuickKeySlot({ key: '0', altKey: true })).toBeNull();
  });
});

describe('short codes', () => {
  const items = [
    { name: 'Masala Dosa', shortCode: '101' },
    { name: 'Filter Coffee', shortCode: 'FC' },
    { name: 'Idli', shortCode: null },
  ];

  it('finds exact codes case-insensitively', () => {
    expect(findItemByShortCode(items, ' fc ')?.name).toBe('Filter Coffee');
    expect(findItemByShortCode(items, '10')).toBeUndefined();
  });

  it('matches search on name or code prefix', () => {
    expect(items.filter((i) => matchesPosSearch(i, '10')).map((i) => i.name)).toEqual([
      'Masala Dosa',
    ]);
    expect(matchesPosSearch(items[2], 'idl')).toBe(true);
  });
});
