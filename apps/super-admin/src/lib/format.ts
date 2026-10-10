const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('en-IN');
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export function formatInr(value: number | null | undefined): string {
  return value == null ? '—' : inrFmt.format(value);
}

/** Indian short form: ₹1.09L, ₹13.2Cr, ₹45.5K. */
export function formatInrCompact(value: number | null | undefined): string {
  if (value == null) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const fmt = (n: number) => {
    const s = n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2);
    return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
  };
  if (abs >= 1e7) return `${sign}₹${fmt(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${fmt(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${fmt(abs / 1e3)}K`;
  return formatInr(value);
}

export function formatNumber(value: number | null | undefined): string {
  return value == null ? '—' : numFmt.format(value);
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  const diff = (d.getTime() - Date.now()) / 1000;
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return 'just now';
}

/** Percent change between two counts, or null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}
