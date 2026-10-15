import { parsePhoneValue } from '@cullinos/ui';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Amounts from the API are in paise (minor units). */
export function formatMoney(paise: number): string {
  return inrFormatter.format(paise / 100);
}

const inrExactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Paise-precise money for bills / tax breakdowns. */
export function formatMoneyExact(paise: number): string {
  return inrExactFormatter.format(paise / 100);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Date only, unambiguous day-first: `14 Oct 2026`. */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

/** Display a stored phone: `+91 98765 43210` for India, `+<dial> <national>` elsewhere. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '—';
  const { dial, national } = parsePhoneValue(value);
  if (!national) return value;
  if (dial === '91' && national.length === 10) {
    return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return `+${dial} ${national}`;
}

/** Validates a `PhoneField` value: 10 digits for India (+91), at least 7 elsewhere. */
export function isValidMobile(value: string): boolean {
  const { dial, national } = parsePhoneValue(value);
  return dial === '91' ? national.length === 10 : national.length >= 7;
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
