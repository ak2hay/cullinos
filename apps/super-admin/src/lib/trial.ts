import { DEFAULT_TRIAL_DAYS, MAX_TRIAL_DAYS } from '@cullinos/shared';

export { DEFAULT_TRIAL_DAYS, MAX_TRIAL_DAYS };

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** `YYYY-MM-DD` for `<input type="date">`, `days` from `from` (default today). */
export function dateInputPlusDays(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}

/** A trial runs through the end of the chosen local day. */
export function dateInputToTrialIso(value: string): string {
  return new Date(`${value}T23:59:59`).toISOString();
}

export function isoToDateInput(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : toDateInput(d);
}
