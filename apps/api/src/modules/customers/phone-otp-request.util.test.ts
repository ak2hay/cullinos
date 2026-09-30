import { describe, expect, it, vi } from "vitest";
import { HttpException, UnauthorizedException } from "@nestjs/common";
import {
  assertPhoneOtpSendAllowed,
  consumePhoneOtpChallenge,
  isIndianMobile,
  PHONE_OTP_PER_PHONE_PER_HOUR,
} from "./phone-otp-request.util";

function challenge(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    phone: "919876543210",
    organizationId: "org1",
    codeHash: "good",
    purpose: "customer_login",
    attempts: 0,
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

describe("isIndianMobile", () => {
  it("accepts 91 + 10-digit mobiles starting 6-9", () => {
    expect(isIndianMobile("919876543210")).toBe(true);
    expect(isIndianMobile("916000000000")).toBe(true);
  });
  it("rejects non-Indian or landline-shaped numbers", () => {
    expect(isIndianMobile("15551234567")).toBe(false);
    expect(isIndianMobile("911234567890")).toBe(false);
    expect(isIndianMobile("9876543210")).toBe(false);
  });
});

describe("assertPhoneOtpSendAllowed", () => {
  it("allows under the limits", async () => {
    const prisma = { phoneOtp: { count: vi.fn().mockResolvedValue(0) } };
    await expect(
      assertPhoneOtpSendAllowed(prisma as never, { phone: "919876543210", organizationId: "o" }),
    ).resolves.toBeUndefined();
  });
  it("blocks when the per-phone hourly limit is hit", async () => {
    const prisma = {
      phoneOtp: { count: vi.fn().mockResolvedValue(PHONE_OTP_PER_PHONE_PER_HOUR) },
    };
    await expect(
      assertPhoneOtpSendAllowed(prisma as never, { phone: "919876543210", organizationId: "o" }),
    ).rejects.toBeInstanceOf(HttpException);
  });
});

describe("consumePhoneOtpChallenge", () => {
  it("scopes the lookup by purpose so customer OTPs cannot log in staff", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { phoneOtp: { findFirst, updateMany: vi.fn() } };
    await expect(
      consumePhoneOtpChallenge(prisma as never, {
        challengeToken: "t",
        codeHash: "good",
        purpose: "staff_login",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findFirst).toHaveBeenCalledWith({
      where: { challengeToken: "t", purpose: "staff_login" },
    });
  });

  it("counts wrong guesses with a conditional update", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      phoneOtp: { findFirst: vi.fn().mockResolvedValue(challenge()), updateMany },
    };
    await expect(
      consumePhoneOtpChallenge(prisma as never, {
        challengeToken: "t",
        codeHash: "bad",
        purpose: "customer_login",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "c1", consumedAt: null, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
  });

  it("rejects when a parallel request already consumed the challenge", async () => {
    const prisma = {
      phoneOtp: {
        findFirst: vi.fn().mockResolvedValue(challenge()),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    await expect(
      consumePhoneOtpChallenge(prisma as never, {
        challengeToken: "t",
        codeHash: "good",
        purpose: "customer_login",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("returns the challenge when the code matches and the claim wins", async () => {
    const prisma = {
      phoneOtp: {
        findFirst: vi.fn().mockResolvedValue(challenge()),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const row = await consumePhoneOtpChallenge(prisma as never, {
      challengeToken: "t",
      codeHash: "good",
      purpose: "customer_login",
    });
    expect(row.id).toBe("c1");
  });
});
