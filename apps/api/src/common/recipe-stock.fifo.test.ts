import { describe, expect, it } from "vitest";
import {
  allocateFifoLots,
  blendUnitCost,
  weightedAverageCost,
} from "./recipe-stock.util";

describe("FIFO lot allocation", () => {
  it("consumes oldest lots first", () => {
    const lots = [
      {
        id: "new",
        qtyRemaining: 10,
        unitCost: 20,
        receivedAt: "2026-09-10T00:00:00.000Z",
      },
      {
        id: "old",
        qtyRemaining: 5,
        unitCost: 10,
        receivedAt: "2026-09-01T00:00:00.000Z",
      },
    ];
    const alloc = allocateFifoLots(lots, 7);
    expect(alloc).toEqual([
      { lotId: "old", qty: 5, unitCost: 10 },
      { lotId: "new", qty: 2, unitCost: 20 },
    ]);
  });

  it("stops when lots are exhausted", () => {
    const lots = [
      { id: "a", qtyRemaining: 2, unitCost: 5, receivedAt: "2026-01-01" },
    ];
    expect(allocateFifoLots(lots, 10)).toEqual([
      { lotId: "a", qty: 2, unitCost: 5 },
    ]);
  });

  it("computes remaining weighted average", () => {
    expect(
      weightedAverageCost([
        { qtyRemaining: 2, unitCost: 10 },
        { qtyRemaining: 2, unitCost: 20 },
      ]),
    ).toBe(15);
  });

  it("blends unit cost on receive", () => {
    expect(blendUnitCost(10, 10, 10, 20)).toBe(15);
    expect(blendUnitCost(0, 0, 5, 12)).toBe(12);
  });
});
