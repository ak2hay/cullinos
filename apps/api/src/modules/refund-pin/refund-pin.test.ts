import "reflect-metadata";
import { BadRequestException, HttpException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@cullinos/auth", () => ({
  hashPassword: vi.fn(async (value: string) => `hash:${value}`),
  verifyPassword: vi.fn(async (value: string, hash: string) => hash === `hash:${value}`),
}));

import { PERMISSIONS_KEY } from "../../common/decorators/permissions.decorator";
import { OrdersController } from "../orders/orders.controller";
import { OrdersService } from "../orders/orders.service";
import { RefundPinService } from "./refund-pin.service";
import {
  REFUND_PIN_INVALID_CODE,
  REFUND_PIN_LOCKED_CODE,
  REFUND_PIN_NOT_SET_CODE,
  REFUND_PIN_REQUIRED_CODE,
  isPinLocked,
  isValidRefundPin,
  pinFailureOutcome,
} from "./refund-pin.util";

function errorCode(err: unknown): string | undefined {
  if (!(err instanceof HttpException)) return undefined;
  const body = err.getResponse();
  return typeof body === "object" && body ? (body as { code?: string }).code : undefined;
}

describe("refund pin utils", () => {
  it("accepts exactly four digits", () => {
    expect(isValidRefundPin("1234")).toBe(true);
    expect(isValidRefundPin("0000")).toBe(true);
    expect(isValidRefundPin("123")).toBe(false);
    expect(isValidRefundPin("12345")).toBe(false);
    expect(isValidRefundPin("12a4")).toBe(false);
    expect(isValidRefundPin(1234)).toBe(false);
  });

  it("locks on the fifth wrong attempt", () => {
    expect(pinFailureOutcome(1)).toEqual({ lock: false, remaining: 4 });
    expect(pinFailureOutcome(4)).toEqual({ lock: false, remaining: 1 });
    expect(pinFailureOutcome(5)).toEqual({ lock: true, remaining: 0 });
  });

  it("treats an expired lock as unlocked", () => {
    const now = new Date("2026-10-04T12:00:00Z");
    expect(isPinLocked(new Date("2026-10-04T12:05:00Z"), now)).toBe(true);
    expect(isPinLocked(new Date("2026-10-04T11:55:00Z"), now)).toBe(false);
    expect(isPinLocked(null, now)).toBe(false);
  });
});

describe("RefundPinService", () => {
  let user: Record<string, unknown>;
  let prisma: {
    user: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  };
  let audit: { log: ReturnType<typeof vi.fn> };
  let svc: RefundPinService;

  beforeEach(() => {
    user = {
      id: "user_1",
      passwordHash: "hash:secret-password",
      refundPinHash: "hash:4321",
      refundPinLockedUntil: null,
      refundPinFailedAttempts: 0,
    };
    prisma = {
      user: {
        findFirst: vi.fn(async () => user),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const inc = data.refundPinFailedAttempts as { increment?: number } | number | undefined;
          if (typeof inc === "object" && inc?.increment) {
            user.refundPinFailedAttempts = (user.refundPinFailedAttempts as number) + inc.increment;
          } else {
            Object.assign(user, data);
          }
          return user;
        }),
      },
    };
    audit = { log: vi.fn() };
    svc = new RefundPinService(prisma as never, audit as never);
  });

  it("scopes the user lookup to the organization", async () => {
    await svc.verify("org_1", "user_1", "4321", { orderId: "ord_1" });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "user_1", organizationId: "org_1" }),
      }),
    );
  });

  it("rejects a wrong pin, audits it and reports attempts left", async () => {
    const err = await svc.verify("org_1", "user_1", "1111", { orderId: "ord_1" }).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(errorCode(err)).toBe(REFUND_PIN_INVALID_CODE);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "order.refund_pin_failed", entityId: "ord_1" }),
    );
  });

  it("locks after five wrong attempts and then refuses the correct pin", async () => {
    for (let i = 0; i < 4; i += 1) {
      await svc.verify("org_1", "user_1", "0000", { orderId: "ord_1" }).catch(() => undefined);
    }
    const fifth = await svc.verify("org_1", "user_1", "0000", { orderId: "ord_1" }).catch((e) => e);
    expect(errorCode(fifth)).toBe(REFUND_PIN_LOCKED_CODE);
    expect(user.refundPinLockedUntil).toBeInstanceOf(Date);

    const afterLock = await svc.verify("org_1", "user_1", "4321", { orderId: "ord_1" }).catch((e) => e);
    expect(errorCode(afterLock)).toBe(REFUND_PIN_LOCKED_CODE);
  });

  it("asks the user to set a pin first", async () => {
    user.refundPinHash = null;
    const err = await svc.verify("org_1", "user_1", "4321", { orderId: "ord_1" }).catch((e) => e);
    expect(errorCode(err)).toBe(REFUND_PIN_NOT_SET_CODE);
  });

  it("requires the account password to set a pin", async () => {
    await expect(svc.setPin("org_1", "user_1", "wrong", "1234")).rejects.toThrow(
      "Account password is incorrect",
    );
    await expect(svc.setPin("org_1", "user_1", "secret-password", "12")).rejects.toThrow(
      "exactly 4 digits",
    );
    await svc.setPin("org_1", "user_1", "secret-password", "1234");
    expect(user.refundPinHash).toBe("hash:1234");
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.refund_pin_set" }),
    );
  });
});

describe("refund endpoint permissions", () => {
  it("requires order:refund only (not order:update)", () => {
    const perms = Reflect.getMetadata(PERMISSIONS_KEY, OrdersController.prototype.refund);
    expect(perms).toEqual(["order:refund"]);
  });
});

describe("OrdersService cancel on paid orders", () => {
  function ordersServiceFor(paidAmounts: number[]) {
    const aggregate = vi.fn();
    for (const amount of paidAmounts) {
      aggregate.mockResolvedValueOnce({ _sum: { amount } });
    }
    const prisma = {
      order: {
        findFirst: vi.fn().mockResolvedValue({
          id: "ord_1",
          organizationId: "org_1",
          outletId: "out_1",
          status: "confirmed",
          notes: null,
        }),
      },
      payment: { aggregate },
    };
    const payments = { refundCompletedForOrder: vi.fn().mockResolvedValue({ refunded: 1 }) };
    const svc = new OrdersService(
      prisma as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      payments as never,
    );
    return { svc, payments };
  }

  it("blocks cancelling a paid order without passcode authorization", async () => {
    const { svc, payments } = ordersServiceFor([320]);
    const err = await svc.cancel("org_1", "ord_1").catch((e) => e);
    expect(errorCode(err)).toBe(REFUND_PIN_REQUIRED_CODE);
    expect(payments.refundCompletedForOrder).not.toHaveBeenCalled();
  });

  it("blocks the status route's cancel path too", async () => {
    const { svc, payments } = ordersServiceFor([320]);
    const err = await svc.updateStatus("org_1", "ord_1", "cancelled").catch((e) => e);
    expect(errorCode(err)).toBe(REFUND_PIN_REQUIRED_CODE);
    expect(payments.refundCompletedForOrder).not.toHaveBeenCalled();
  });

  it("refunds when the refund endpoint authorized it", async () => {
    const { svc, payments } = ordersServiceFor([320, 320]);
    await svc
      .cancel("org_1", "ord_1", undefined, { refundAuthorized: true, userId: "user_1" })
      .catch(() => undefined);
    expect(payments.refundCompletedForOrder).toHaveBeenCalledWith(
      "org_1",
      "ord_1",
      expect.objectContaining({ outletId: "out_1", userId: "user_1" }),
    );
  });
});
