import { describe, expect, it } from "vitest";
import {
  shouldFailPhoneOtpWhenUnsent,
} from "./phone-otp-request.util";

describe("phone OTP request SMS delivery policy", () => {
  it("fails in production when SMS was not sent", () => {
    expect(shouldFailPhoneOtpWhenUnsent(false, "production")).toBe(true);
  });

  it("does not fail in production when SMS was sent", () => {
    expect(shouldFailPhoneOtpWhenUnsent(true, "production")).toBe(false);
  });

  it("allows unsent SMS in non-production (dev log / debugOtp path)", () => {
    expect(shouldFailPhoneOtpWhenUnsent(false, "development")).toBe(false);
    expect(shouldFailPhoneOtpWhenUnsent(false, "test")).toBe(false);
    expect(shouldFailPhoneOtpWhenUnsent(false, undefined)).toBe(false);
  });
});
