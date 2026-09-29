import { describe, expect, it, vi } from "vitest";
import { WalletService, smsChargePaise, smsSegments } from "./wallet.service";

describe("smsChargePaise", () => {
  it("charges pro-rata (37 SMS = 37% of per-100 pack)", () => {
    expect(smsChargePaise(37, 10_000)).toBe(3700);
  });

  it("rounds half up via Math.round", () => {
    expect(smsChargePaise(1, 100)).toBe(1);
    expect(smsChargePaise(0, 10_000)).toBe(0);
  });
});

describe("smsSegments", () => {
  it("fits 160 GSM-7 characters in one part and splits at 153", () => {
    expect(smsSegments("a".repeat(160))).toBe(1);
    expect(smsSegments("a".repeat(161))).toBe(2);
    expect(smsSegments("a".repeat(306))).toBe(2);
    expect(smsSegments("a".repeat(307))).toBe(3);
  });

  it("counts extended GSM characters twice", () => {
    expect(smsSegments("{".repeat(80))).toBe(1);
    expect(smsSegments("{".repeat(81))).toBe(2);
  });

  it("falls back to UCS-2 (70 / 67) for the rupee sign", () => {
    expect(smsSegments(`Total ₹${"1".repeat(63)}`)).toBe(1);
    expect(smsSegments(`Total ₹${"1".repeat(64)}`)).toBe(2);
  });
});

describe("WalletService reservations", () => {
  function makeService() {
    const config = { get: vi.fn().mockReturnValue("10000") };
    const svc = new WalletService({} as never, config as never, {} as never);
    const debit = vi
      .spyOn(svc, "debit")
      .mockResolvedValue({ balancePaise: 0, entry: { id: "entry-1" } } as never);
    const credit = vi.spyOn(svc, "credit").mockResolvedValue({} as never);
    return { svc, debit, credit };
  }

  it("debits the full cost up front", async () => {
    const { svc, debit } = makeService();
    const reservation = await svc.reserveCharge("org-1", "sms", 6, {
      referenceType: "sms_campaign",
      referenceId: "c1",
      note: "x",
    });
    expect(debit).toHaveBeenCalledWith("org-1", 600, "sms_charge", expect.any(Object));
    expect(reservation).toEqual({ entryId: "entry-1", amountPaise: 600, type: "sms_charge" });
  });

  it("refunds the undelivered share once, keyed to the reservation", async () => {
    const { svc, credit } = makeService();
    const kept = await svc.settleReservation(
      "org-1",
      { entryId: "entry-1", amountPaise: 600, type: "sms_charge" },
      6,
      2,
    );
    expect(kept).toBe(200);
    expect(credit).toHaveBeenCalledWith(
      "org-1",
      400,
      "refund",
      expect.objectContaining({ entryId: "refund_entry-1" }),
    );
  });

  it("keeps everything when all messages went out", async () => {
    const { svc, credit } = makeService();
    const kept = await svc.settleReservation(
      "org-1",
      { entryId: "entry-1", amountPaise: 600, type: "sms_charge" },
      6,
      6,
    );
    expect(kept).toBe(600);
    expect(credit).not.toHaveBeenCalled();
  });
});
