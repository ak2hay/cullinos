import { describe, expect, it } from "vitest";
import { THREE_ITEM_CASH_ORDER, changeDue, tenderChips } from "./cashTender";

describe("cash tender chips", () => {
  it("offers the exact amount and the next notes", () => {
    expect(tenderChips(247)).toEqual([247, 500, 2000]);
    expect(tenderChips(100)).toEqual([100, 200, 500, 2000]);
    expect(tenderChips(40)).toEqual([40, 100, 200, 500]);
    expect(tenderChips(2000)).toEqual([2000]);
  });

  it("shows change only when the note is larger than the bill", () => {
    expect(changeDue(500, 247)).toBe(253);
    expect(changeDue(247, 247)).toBe(0);
    expect(changeDue(100, 247)).toBe(0);
  });
});

describe("3-item cash order", () => {
  it("drops a tap and the blocking second request", () => {
    expect(THREE_ITEM_CASH_ORDER.before.taps).toBe(5);
    expect(THREE_ITEM_CASH_ORDER.after.taps).toBe(4);
    expect(THREE_ITEM_CASH_ORDER.before.blockingApiRequests).toBe(2);
    expect(THREE_ITEM_CASH_ORDER.after.blockingApiRequests).toBe(0);
    expect(THREE_ITEM_CASH_ORDER.after.backgroundApiRequests).toBe(1);
  });
});
