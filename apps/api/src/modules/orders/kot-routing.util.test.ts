import { describe, expect, it } from "vitest";
import { groupItemsByStation, kotNumberFor, stationCodeFor } from "./kot-routing.util";

const BAR = { id: "st-bar", code: "BAR" };

describe("groupItemsByStation", () => {
  it("keeps a single default ticket when nothing is routed", () => {
    const groups = groupItemsByStation(
      [
        { id: "a", stationCode: null },
        { id: "b", stationCode: null },
      ],
      [BAR],
    );
    expect(groups).toEqual([{ stationId: null, stationCode: null, itemIds: ["a", "b"] }]);
  });

  it("splits bar items onto their own ticket", () => {
    const groups = groupItemsByStation(
      [
        { id: "food", stationCode: null },
        { id: "beer", stationCode: "bar" },
        { id: "whisky", stationCode: "BAR" },
      ],
      [BAR],
    );
    expect(groups).toEqual([
      { stationId: null, stationCode: null, itemIds: ["food"] },
      { stationId: "st-bar", stationCode: "BAR", itemIds: ["beer", "whisky"] },
    ]);
  });

  it("falls back to the default ticket when the outlet has no matching station", () => {
    const groups = groupItemsByStation([{ id: "beer", stationCode: "BAR" }], []);
    expect(groups).toEqual([{ stationId: null, stationCode: null, itemIds: ["beer"] }]);
  });
});

describe("stationCodeFor", () => {
  it("routes alcohol to the bar when the category has no station", () => {
    expect(stationCodeFor(null, "alcohol")).toBe("BAR");
    expect(stationCodeFor("  ", "alcohol")).toBe("BAR");
  });

  it("keeps an explicit category station even for alcohol", () => {
    expect(stationCodeFor("GRILL", "alcohol")).toBe("GRILL");
  });

  it("leaves non-alcohol items on the default ticket", () => {
    expect(stationCodeFor(null, "main_course")).toBeNull();
    expect(stationCodeFor(null, null)).toBeNull();
  });

  it("puts uncategorised drinks on the bar ticket with food on the default", () => {
    const items = [
      { id: "fries", stationCode: stationCodeFor(null, null) },
      { id: "beer", stationCode: stationCodeFor(null, "alcohol") },
    ];
    expect(groupItemsByStation(items, [BAR])).toEqual([
      { stationId: null, stationCode: null, itemIds: ["fries"] },
      { stationId: "st-bar", stationCode: "BAR", itemIds: ["beer"] },
    ]);
  });
});

describe("kotNumberFor", () => {
  it("suffixes station tickets only", () => {
    expect(kotNumberFor("K0012", { stationId: null, stationCode: null, itemIds: [] })).toBe("K0012");
    expect(kotNumberFor("K0012", { stationId: "s", stationCode: "BAR", itemIds: [] })).toBe(
      "K0012-BAR",
    );
  });
});
