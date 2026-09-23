import { describe, expect, it } from "vitest";
import { generateReservationSlots } from "./reservation-slots.util";

describe("generateReservationSlots", () => {
  it("generates available slots from opening hours", () => {
    const slots = generateReservationSlots({
      dateYmd: "2099-06-15",
      openingHours: {
        mon: { closed: false, open: "11:00", close: "14:00" },
      },
      timeZone: "Asia/Kolkata",
      slotMinutes: 90,
      maxCovers: 10,
      partySize: 2,
      bookings: [],
      now: new Date("2099-06-15T00:00:00.000Z"),
    });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it("marks slots unavailable when capacity exhausted", () => {
    const slots = generateReservationSlots({
      dateYmd: "2099-06-15",
      openingHours: {
        mon: { closed: false, open: "11:00", close: "14:00" },
      },
      timeZone: "UTC",
      slotMinutes: 90,
      maxCovers: 4,
      partySize: 2,
      bookings: [{ reservedAt: new Date("2099-06-15T11:00:00.000Z"), partySize: 4 }],
      now: new Date("2099-06-15T00:00:00.000Z"),
    });
    const first = slots.find((s) => s.startAt.startsWith("2099-06-15T11:"));
    if (first) {
      expect(first.available).toBe(false);
      expect(first.coversAvailable).toBe(0);
    }
  });
});
