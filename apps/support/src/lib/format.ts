const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

export function relativeTime(value: string | null | undefined): string {
  if (!value) return '';
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return 'just now';
}

/** "2h 15m left" / "3h overdue" for an SLA target. */
export function slaLabel(due: string | null | undefined): { text: string; tone: 'ok' | 'warn' | 'breach' } | null {
  if (!due) return null;
  const ms = new Date(due).getTime() - Date.now();
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const span = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
  if (ms < 0) return { text: `${span} overdue`, tone: 'breach' };
  return { text: `${span} left`, tone: ms < 2 * 3_600_000 ? 'warn' : 'ok' };
}

export function personName(p: { name?: string; email?: string; employeeCode?: string | null } | null | undefined) {
  if (!p) return 'Unassigned';
  return p.name || p.email || 'Unknown';
}
