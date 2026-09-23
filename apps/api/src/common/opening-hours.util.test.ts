import { describe, expect, it } from "vitest";
import { computeOpenNow, normalizeOpeningHours } from "./opening-hours.util";

const hours = {
  mon: { closed: false, open: "09:00", close: "22:00" },
  tue: { closed: false, open: "09:00", close: "22:00" },
  wed: { closed: false, open: "09:00", close: "22:00" },
  thu: { closed: false, open: "09:00", close: "22:00" },
  fri: { closed: false, open: "09:00", close: "23:00" },
  sat: { closed: false, open: "10:00", close: "23:00" },
  sun: { closed: true, open: "00:00", close: "00:00" },
};

describe("opening-hours.util", () => {
  it("normalizes day entries", () => {
    const n = normalizeOpeningHours({ mon: { closed: false, open: "10:00", close: "18:00" } });
    expect(n?.mon).toEqual({ closed: false, open: "10:00", close: "18:00" });
    expect(normalizeOpeningHours(null)).toBeNull();
  });

  it("computes openNow in Asia/Kolkata", () => {
    // 2026-09-18 is a Friday
    const fridayNoonIst = new Date("2026-09-18T06:30:00.000Z"); // 12:00 IST
    expect(computeOpenNow(hours, fridayNoonIst, "Asia/Kolkata")).toBe(true);

    const fridayLate = new Date("2026-09-18T18:00:00.000Z"); // 23:30 IST
    expect(computeOpenNow(hours, fridayLate, "Asia/Kolkata")).toBe(false);

    const sundayNoon = new Date("2026-09-20T06:30:00.000Z");
    expect(computeOpenNow(hours, sundayNoon, "Asia/Kolkata")).toBe(false);
  });

  it("handles overnight windows", () => {
    const overnight = {
      fri: { closed: false, open: "22:00", close: "02:00" },
    };
    const fri2330 = new Date("2026-09-18T18:00:00.000Z"); // 23:30 IST Fri
    expect(computeOpenNow(overnight, fri2330, "Asia/Kolkata")).toBe(true);
    const sat0130 = new Date("2026-09-18T20:00:00.000Z"); // 01:30 IST Sat
    // Saturday has no entry → null
    expect(computeOpenNow(overnight, sat0130, "Asia/Kolkata")).toBeNull();
  });
});
