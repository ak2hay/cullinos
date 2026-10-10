import { describe, expect, it } from "vitest";
import { onCallUserId, rotationSchedule, slaDueAt } from "./on-call.util";

const startsAt = new Date("2026-10-01T00:00:00Z");
const rotation = { memberUserIds: ["a", "b", "c"], rotationDays: 7, startsAt, isActive: true };
const day = (n: number) => new Date(startsAt.getTime() + n * 24 * 3600_000);

describe("on-call rotation", () => {
  it("rotates members every rotationDays and wraps around", () => {
    expect(onCallUserId(rotation, day(0))).toBe("a");
    expect(onCallUserId(rotation, day(7))).toBe("b");
    expect(onCallUserId(rotation, day(20))).toBe("c");
    expect(onCallUserId(rotation, day(21))).toBe("a");
  });

  it("returns null before the start, when inactive or empty", () => {
    expect(onCallUserId(rotation, day(-1))).toBeNull();
    expect(onCallUserId({ ...rotation, isActive: false }, day(1))).toBeNull();
    expect(onCallUserId({ ...rotation, memberUserIds: [] }, day(1))).toBeNull();
  });

  it("lists upcoming hand-offs from the current turn", () => {
    const s = rotationSchedule(rotation, day(8), 2);
    expect(s.map((x) => x.userId)).toEqual(["b", "c"]);
    expect(s[0].from).toEqual(day(7));
    expect(s[1].to).toEqual(day(21));
  });
});

describe("slaDueAt", () => {
  it("adds hours by priority", () => {
    expect(slaDueAt("urgent", startsAt)).toEqual(new Date("2026-10-01T04:00:00Z"));
    expect(slaDueAt("low", startsAt)).toEqual(new Date("2026-10-04T00:00:00Z"));
  });
});
