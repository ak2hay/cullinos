export const DEFAULT_ORG_TIMEZONE = "Asia/Kolkata";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function safeZone(timeZone?: string | null): string {
  if (!timeZone) return DEFAULT_ORG_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_ORG_TIMEZONE;
  }
}

function zoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = zoneParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Calendar date (YYYY-MM-DD) of `date` in the org's timezone. */
export function ymdInZone(date: Date, timeZone?: string | null): string {
  const p = zoneParts(date, safeZone(timeZone));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Hour of day (0–23) of `date` in the org's timezone. */
export function hourInZone(date: Date, timeZone?: string | null): number {
  return zoneParts(date, safeZone(timeZone)).hour;
}

/** UTC instant of local midnight at the start of `ymd` in `timeZone`. */
export function zonedMidnight(ymd: string, timeZone?: string | null): Date {
  const zone = safeZone(timeZone);
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const first = offsetMs(new Date(guess), zone);
  let result = guess - first;
  const second = offsetMs(new Date(result), zone);
  if (second !== first) result = guess - second;
  return new Date(result);
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

function toYmd(input: string | undefined, timeZone: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (YMD.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : ymdInZone(parsed, timeZone);
}

export type OrgDayRange = {
  /** Inclusive start (local midnight of `fromYmd`). */
  start: Date;
  /** Exclusive end (local midnight after `toYmd`). */
  end: Date;
  fromYmd: string;
  toYmd: string;
  timeZone: string;
};

/**
 * Report date range as whole calendar days in the org timezone.
 * `from` defaults to today; `to` defaults to `from`.
 */
export function orgDayRange(
  from: string | undefined,
  to: string | undefined,
  timeZone?: string | null,
  now: Date = new Date(),
): OrgDayRange {
  const zone = safeZone(timeZone);
  const fromYmd = toYmd(from, zone) ?? ymdInZone(now, zone);
  let lastYmd = toYmd(to, zone) ?? fromYmd;
  if (lastYmd < fromYmd) lastYmd = fromYmd;
  return {
    start: zonedMidnight(fromYmd, zone),
    end: zonedMidnight(addDays(lastYmd, 1), zone),
    fromYmd,
    toYmd: lastYmd,
    timeZone: zone,
  };
}
