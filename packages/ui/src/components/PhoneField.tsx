import { useMemo } from 'react';
import { cn } from '../utils';
import { Field, fieldId } from './Field';

export type DialCodeOption = {
  /** Digits only, e.g. "91" */
  dial: string;
  /** ISO-ish label, e.g. "IN" */
  iso: string;
  label: string;
};

/** Curated dial codes; India (+91) first / default. */
export const DIAL_CODES: DialCodeOption[] = [
  { dial: '91', iso: 'IN', label: 'India (+91)' },
  { dial: '971', iso: 'AE', label: 'UAE (+971)' },
  { dial: '65', iso: 'SG', label: 'Singapore (+65)' },
  { dial: '1', iso: 'US', label: 'US/CA (+1)' },
  { dial: '44', iso: 'GB', label: 'UK (+44)' },
  { dial: '61', iso: 'AU', label: 'Australia (+61)' },
  { dial: '966', iso: 'SA', label: 'Saudi (+966)' },
  { dial: '974', iso: 'QA', label: 'Qatar (+974)' },
  { dial: '968', iso: 'OM', label: 'Oman (+968)' },
  { dial: '973', iso: 'BH', label: 'Bahrain (+973)' },
  { dial: '60', iso: 'MY', label: 'Malaysia (+60)' },
  { dial: '94', iso: 'LK', label: 'Sri Lanka (+94)' },
  { dial: '977', iso: 'NP', label: 'Nepal (+977)' },
  { dial: '880', iso: 'BD', label: 'Bangladesh (+880)' },
];

export const DEFAULT_DIAL_CODE = '91';

/** Regional-indicator flag emoji for a 2-letter ISO code (falls back to letters where unsupported). */
export function isoToFlag(iso: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso)) return iso;
  return String.fromCodePoint(
    ...iso.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Split a stored phone into dial code + national number. */
export function parsePhoneValue(
  value: string,
  defaultDial = DEFAULT_DIAL_CODE,
): { dial: string; national: string } {
  const digits = digitsOnly(value);
  if (!digits) return { dial: defaultDial, national: '' };

  const sorted = [...DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);
  for (const opt of sorted) {
    if (digits.startsWith(opt.dial) && digits.length > opt.dial.length) {
      return { dial: opt.dial, national: digits.slice(opt.dial.length) };
    }
  }
  if (digits.length <= 10) {
    return { dial: defaultDial, national: digits };
  }
  return { dial: defaultDial, national: digits };
}

/** Compose E.164-style string with leading +. */
export function composePhone(dial: string, national: string): string {
  const d = digitsOnly(dial);
  const n = digitsOnly(national);
  if (!n) return '';
  return `+${d}${n}`;
}

export interface PhoneFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  /** Digits-only dial code without +, default "91". */
  defaultDialCode?: string;
}

export function PhoneField({
  label,
  value,
  onChange,
  error,
  id,
  disabled,
  required,
  placeholder = '9876543210',
  className,
  defaultDialCode = DEFAULT_DIAL_CODE,
}: PhoneFieldProps) {
  const inputId = fieldId(label, id);
  const { dial, national } = useMemo(
    () => parsePhoneValue(value, defaultDialCode),
    [value, defaultDialCode],
  );

  function emit(nextDial: string, nextNational: string) {
    onChange(composePhone(nextDial, nextNational));
  }

  return (
    <Field label={label} htmlFor={inputId} error={error} className={className}>
      <div className="flex w-full min-w-0 items-stretch gap-2">
        <select
          aria-label={`${label} country code`}
          className={cn(
            'h-11 w-[6.75rem] flex-none rounded-lg border border-white/10 bg-bg-card pl-2 pr-1 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20',
            error && 'border-status-error',
          )}
          value={dial}
          disabled={disabled}
          onChange={(e) => emit(e.target.value, national)}
        >
          {DIAL_CODES.map((opt) => (
            <option key={opt.dial} value={opt.dial}>
              {isoToFlag(opt.iso)} +{opt.dial}
            </option>
          ))}
        </select>
        <div className="relative min-w-0 flex-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <input
            id={inputId}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={15}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            className={cn(
              'h-11 w-full min-w-0 rounded-lg border border-white/10 bg-bg-card pl-9 pr-3 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20',
              error && 'border-status-error',
            )}
            value={national}
            onChange={(e) => emit(dial, e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
    </Field>
  );
}
