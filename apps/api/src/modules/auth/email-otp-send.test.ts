import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import {
  EMAIL_OTP_SEND_FAILED_MESSAGE,
  shouldFailEmailOtpWhenUnsent,
} from "./email-otp-send.util";

function makeAuthService(sendOtpEmail: ReturnType<typeof vi.fn>) {
  const user = { id: "u1", email: "ops@example.com", organizationId: "org1", organization: null };
  const prisma = {
    user: { findFirst: vi.fn().mockResolvedValue(user) },
    emailOtp: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const jwt = { sign: vi.fn().mockReturnValue("challenge-token"), verify: vi.fn() };
  const mail = { sendOtpEmail };
  const config = { get: vi.fn() };
  const audit = { log: vi.fn().mockResolvedValue(undefined) };

  const svc = new AuthService(
    prisma as never,
    jwt as never,
    mail as never,
    config as never,
    audit as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { svc, prisma };
}

describe("shouldFailEmailOtpWhenUnsent", () => {
  it("fails only for unsent email in production", () => {
    expect(shouldFailEmailOtpWhenUnsent(false, "production")).toBe(true);
    expect(shouldFailEmailOtpWhenUnsent(true, "production")).toBe(false);
    expect(shouldFailEmailOtpWhenUnsent(false, "development")).toBe(false);
  });
});

describe("email OTP send failure in production", () => {
  const prevEnv = process.env.NODE_ENV;
  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });
  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
  });

  it("login OTP throws and removes the challenge when email is not sent", async () => {
    const { svc, prisma } = makeAuthService(vi.fn().mockResolvedValue(false));
    await expect(svc.startLoginOtp("u1", "ops@example.com")).rejects.toThrow(
      new ServiceUnavailableException(EMAIL_OTP_SEND_FAILED_MESSAGE),
    );
    expect(prisma.emailOtp.deleteMany).toHaveBeenCalledWith({
      where: { challengeToken: "challenge-token" },
    });
  });

  it("login OTP returns a challenge when email is sent", async () => {
    const { svc, prisma } = makeAuthService(vi.fn().mockResolvedValue(true));
    await expect(svc.startLoginOtp("u1", "ops@example.com")).resolves.toEqual({
      requiresOtp: true,
      challengeToken: "challenge-token",
    });
    expect(prisma.emailOtp.deleteMany).not.toHaveBeenCalled();
  });

  it("step-up OTP throws when email is not sent", async () => {
    const { svc } = makeAuthService(vi.fn().mockResolvedValue(false));
    await expect(svc.startStepUp("u1", "ops@example.com")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("forgot password stays generic when email is not sent", async () => {
    const { svc } = makeAuthService(vi.fn().mockResolvedValue(false));
    await expect(svc.forgotPassword("ops@example.com")).resolves.toEqual({ ok: true });
  });
});
