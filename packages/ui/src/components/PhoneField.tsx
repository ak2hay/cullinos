import { useMemo } from 'react';
import { cn } from '../utils';
import { Field, controlClassName, fieldId } from './Field';

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
      <div className="flex gap-2">
        <select
          aria-label={`${label} country code`}
          className={cn(
            controlClassName,
            'w-[8.5rem] shrink-0',
            error && 'border-status-error',
          )}
          value={dial}
          disabled={disabled}
          onChange={(e) => emit(e.target.value, national)}
        >
          {DIAL_CODES.map((opt) => (
            <option key={opt.dial} value={opt.dial}>
              {opt.iso} +{opt.dial}
            </option>
          ))}
        </select>
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-bg-card px-3 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20',
            error && 'border-status-error',
          )}
          value={national}
          onChange={(e) => emit(dial, e.target.value.replace(/\D/g, ''))}
        />
      </div>
    </Field>
  );
}
