/** Day keys used in outlet settings.openingHours JSON. */
export const OPENING_HOUR_DAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export type OpeningHourDay = (typeof OPENING_HOUR_DAYS)[number];

export type DayHours = {
  closed: boolean;
  open: string;
  close: string;
};

export type OpeningHours = Partial<Record<OpeningHourDay, DayHours>>;

const DAY_FROM_SHORT: Record<string, OpeningHourDay> = {
  mon: "mon",
  tue: "tue",
  wed: "wed",
  thu: "thu",
  fri: "fri",
  sat: "sat",
  sun: "sun",
};

function parseHhMm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function normalizeOpeningHours(raw: unknown): OpeningHours | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: OpeningHours = {};
  let any = false;
  for (const day of OPENING_HOUR_DAYS) {
    const entry = src[day];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    const closed = Boolean(e.closed);
    const open = typeof e.open === "string" ? e.open : "09:00";
    const close = typeof e.close === "string" ? e.close : "22:00";
    out[day] = { closed, open, close };
    any = true;
  }
  return any ? out : null;
}

export function hasConfiguredOpeningHours(raw: unknown): boolean {
  return normalizeOpeningHours(raw) != null;
}

/**
 * Returns true/false when hours are configured; null when unknown/missing.
 */
export function computeOpenNow(
  openingHours: unknown,
  now: Date = new Date(),
  timeZone = "Asia/Kolkata",
): boolean | null {
  const hours = normalizeOpeningHours(openingHours);
  if (!hours) return null;

  let weekdayShort = "mon";
  let minutesOfDay = 0;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const wd = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() ?? "mon";
    weekdayShort = wd.slice(0, 3);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    // Intl may emit "24" for midnight in some environments
    minutesOfDay = ((hour === 24 ? 0 : hour) * 60 + minute) % (24 * 60);
  } catch {
    const dayIdx = now.getUTCDay(); // fallback: UTC
    weekdayShort = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][dayIdx]!;
    minutesOfDay = now.getUTCHours() * 60 + now.getUTCMinutes();
  }

  const dayKey = DAY_FROM_SHORT[weekdayShort];
  if (!dayKey) return null;
  const today = hours[dayKey];
  if (!today) return null;
  if (today.closed) return false;

  const openMin = parseHhMm(today.open);
  const closeMin = parseHhMm(today.close);
  if (openMin == null || closeMin == null) return null;

  // Overnight window (e.g. 22:00–02:00)
  if (closeMin < openMin) {
    return minutesOfDay >= openMin || minutesOfDay < closeMin;
  }
  return minutesOfDay >= openMin && minutesOfDay < closeMin;
}
