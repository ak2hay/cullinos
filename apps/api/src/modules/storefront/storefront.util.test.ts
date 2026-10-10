import { describe, expect, it } from "vitest";
import { pickPopularItemIds, todayHours } from "./storefront.service";

describe("pickPopularItemIds", () => {
  const menu = [
    { id: "a", isSpecial: false },
    { id: "b", isSpecial: true },
    { id: "c", isSpecial: false },
    { id: "d", isSpecial: true },
  ];

  it("keeps best sellers that are still on the menu, in rank order", () => {
    expect(pickPopularItemIds(["c", "gone", "a"], menu, 2)).toEqual(["c", "a"]);
  });

  it("fills with specials when there is little history", () => {
    expect(pickPopularItemIds(["c"], menu, 3)).toEqual(["c", "b", "d"]);
  });
});

describe("todayHours", () => {
  it("returns today's window in the org timezone", () => {
    // 2026-10-10 is a Saturday.
    const hours = { sat: { open: "11:00", close: "23:00" }, sun: { closed: true } };
    expect(todayHours(hours, new Date("2026-10-10T06:00:00Z"), "Asia/Kolkata")).toEqual({
      closed: false,
      open: "11:00",
      close: "23:00",
    });
  });

  it("returns null when hours are not configured", () => {
    expect(todayHours(null)).toBeNull();
  });
});
