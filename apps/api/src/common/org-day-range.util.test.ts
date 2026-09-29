import { describe, expect, it } from "vitest";
import { hourInZone, orgDayRange, ymdInZone, zonedMidnight } from "./org-day-range.util";

describe("org day range", () => {
  it("maps IST midnight to the previous UTC evening", () => {
    expect(zonedMidnight("2026-09-29", "Asia/Kolkata").toISOString()).toBe(
      "2026-09-28T18:30:00.000Z",
    );
  });

  it("builds an inclusive-exclusive range of whole local days", () => {
    const r = orgDayRange("2026-09-01", "2026-09-02", "Asia/Kolkata");
    expect(r.start.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(r.end.toISOString()).toBe("2026-09-02T18:30:00.000Z");
    expect(r.fromYmd).toBe("2026-09-01");
    expect(r.toYmd).toBe("2026-09-02");
  });

  it("defaults to today in the org zone", () => {
    const now = new Date("2026-09-29T20:00:00.000Z"); // 01:30 IST on the 30th
    const r = orgDayRange(undefined, undefined, "Asia/Kolkata", now);
    expect(r.fromYmd).toBe("2026-09-30");
  });

  it("handles DST zones", () => {
    expect(zonedMidnight("2026-07-01", "America/New_York").toISOString()).toBe(
      "2026-07-01T04:00:00.000Z",
    );
  });

  it("falls back to IST for unknown zones", () => {
    expect(orgDayRange("2026-01-01", undefined, "Not/AZone").timeZone).toBe("Asia/Kolkata");
  });

  it("reports local date and hour", () => {
    const d = new Date("2026-09-29T19:00:00.000Z");
    expect(ymdInZone(d, "Asia/Kolkata")).toBe("2026-09-30");
    expect(hourInZone(d, "Asia/Kolkata")).toBe(0);
  });
});
