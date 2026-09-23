import {
  OPENING_HOUR_DAYS,
  normalizeOpeningHours,
  type OpeningHourDay,
  type OpeningHours,
} from "./opening-hours.util";

export type ReservationSlotSettings = {
  reservationSlotMinutes: number;
  reservationMaxCoversPerSlot: number;
};

export const DEFAULT_RESERVATION_SLOT_SETTINGS: ReservationSlotSettings = {
  reservationSlotMinutes: 90,
  reservationMaxCoversPerSlot: 20,
};

export function readReservationSlotSettings(
  settings: unknown,
): ReservationSlotSettings {
  const raw =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  const minutes = Number(raw.reservationSlotMinutes);
  const covers = Number(raw.reservationMaxCoversPerSlot);
  return {
    reservationSlotMinutes:
      Number.isFinite(minutes) && minutes >= 15 && minutes <= 240
        ? Math.round(minutes)
        : DEFAULT_RESERVATION_SLOT_SETTINGS.reservationSlotMinutes,
    reservationMaxCoversPerSlot:
      Number.isFinite(covers) && covers >= 1 && covers <= 500
        ? Math.round(covers)
        : DEFAULT_RESERVATION_SLOT_SETTINGS.reservationMaxCoversPerSlot,
  };
}

function dayKeyFromDate(dateYmd: string, timeZone: string): OpeningHourDay | null {
  const noon = new Date(`${dateYmd}T12:00:00`);
  if (Number.isNaN(noon.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).formatToParts(noon);
    const wd = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() ?? "";
    const key = wd.slice(0, 3) as OpeningHourDay;
    return OPENING_HOUR_DAYS.includes(key) ? key : null;
  } catch {
    const idx = noon.getUTCDay();
    return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[idx] ?? null;
  }
}

function parseHhMm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function zonedDateTimeIso(
  dateYmd: string,
  minutesOfDay: number,
  timeZone: string,
): string {
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  // Interpret local wall time in outlet timezone via Intl offset probe
  const guessUtc = new Date(`${dateYmd}T${hh}:${mm}:00.000Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  // Binary-search UTC so formatted local matches desired wall clock
  let lo = guessUtc.getTime() - 14 * 60 * 60 * 1000;
  let hi = guessUtc.getTime() + 14 * 60 * 60 * 1000;
  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const parts = formatter.formatToParts(new Date(mid));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
    const localY = Number(get("year"));
    const localMo = Number(get("month"));
    const localD = Number(get("day"));
    let localH = Number(get("hour"));
    if (localH === 24) localH = 0;
    const localM = Number(get("minute"));
    const localMin = localH * 60 + localM;
    const [y, mo, d] = dateYmd.split("-").map(Number);
    const targetMin = minutesOfDay;
    const cmp =
      localY !== y
        ? localY - y!
        : localMo !== mo
          ? localMo - mo!
          : localD !== d
            ? localD - d!
            : localMin - targetMin;
    if (cmp === 0) return new Date(mid).toISOString();
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return new Date(Math.floor((lo + hi) / 2)).toISOString();
}

export type GeneratedSlot = {
  startAt: string;
  endAt: string;
  coversBooked: number;
  coversAvailable: number;
  available: boolean;
};

/**
 * Generate reservation slots for a calendar date from opening hours + capacity.
 * When opening hours are missing, uses 11:00–22:00 local.
 */
export function generateReservationSlots(input: {
  dateYmd: string;
  openingHours: unknown;
  timeZone?: string;
  slotMinutes: number;
  maxCovers: number;
  /** Existing non-cancelled reservations with reservedAt + partySize */
  bookings: Array<{ reservedAt: Date; partySize: number }>;
  partySize?: number;
  now?: Date;
}): GeneratedSlot[] {
  const timeZone = input.timeZone || "Asia/Kolkata";
  const hours: OpeningHours =
    normalizeOpeningHours(input.openingHours) ??
    Object.fromEntries(
      OPENING_HOUR_DAYS.map((d) => [d, { closed: false, open: "11:00", close: "22:00" }]),
    );

  const dayKey = dayKeyFromDate(input.dateYmd, timeZone);
  if (!dayKey) return [];
  const day = hours[dayKey];
  if (!day || day.closed) return [];

  const openMin = parseHhMm(day.open) ?? 11 * 60;
  let closeMin = parseHhMm(day.close) ?? 22 * 60;
  if (closeMin <= openMin) closeMin += 24 * 60; // overnight — only use same-day portion for v1
  closeMin = Math.min(closeMin, 24 * 60);

  const slotMinutes = input.slotMinutes;
  const maxCovers = input.maxCovers;
  const partySize = input.partySize ?? 1;
  const now = input.now ?? new Date();
  const slots: GeneratedSlot[] = [];

  for (let start = openMin; start + slotMinutes <= closeMin; start += slotMinutes) {
    const startAt = zonedDateTimeIso(input.dateYmd, start, timeZone);
    const endAt = zonedDateTimeIso(
      input.dateYmd,
      Math.min(start + slotMinutes, 24 * 60 - 1),
      timeZone,
    );
    const startMs = new Date(startAt).getTime();
    const endMs = new Date(endAt).getTime();
    if (Number.isNaN(startMs) || startMs < now.getTime()) continue;

    let coversBooked = 0;
    for (const b of input.bookings) {
      const t = b.reservedAt.getTime();
      // Count bookings whose start falls in this slot window
      if (t >= startMs && t < endMs) coversBooked += b.partySize;
    }
    const coversAvailable = Math.max(0, maxCovers - coversBooked);
    slots.push({
      startAt,
      endAt,
      coversBooked,
      coversAvailable,
      available: coversAvailable >= partySize,
    });
  }

  return slots;
}
