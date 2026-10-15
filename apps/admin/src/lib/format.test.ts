import { parsePhoneValue } from '@cullinos/ui';
import { describe, expect, it } from 'vitest';
import { formatDay, formatPhone } from './format';

describe('formatPhone', () => {
  it('groups Indian mobiles 5+5', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhone('9876543210')).toBe('+91 98765 43210');
  });

  it('treats a bare 10-digit number as Indian even when it starts like a dial code', () => {
    expect(formatPhone('9123456789')).toBe('+91 91234 56789');
    expect(formatPhone('6012345678')).toBe('+91 60123 45678');
    expect(formatPhone('9712345678')).toBe('+91 97123 45678');
  });

  it('PhoneField splits a bare 10-digit number as national, not by dial prefix', () => {
    expect(parsePhoneValue('9123456789')).toEqual({ dial: '91', national: '9123456789' });
    expect(parsePhoneValue('+919123456789')).toEqual({ dial: '91', national: '9123456789' });
  });

  it('keeps other dial codes', () => {
    expect(formatPhone('+971501234567')).toBe('+971 501234567');
  });

  it('returns a dash for empty values', () => {
    expect(formatPhone(null)).toBe('—');
    expect(formatPhone('')).toBe('—');
  });
});

describe('formatDay', () => {
  it('is day-first with a short month name', () => {
    expect(formatDay('2026-10-14T06:00:00Z')).toBe('14 Oct 2026');
  });

  it('returns a dash for missing dates', () => {
    expect(formatDay(null)).toBe('—');
  });
});
