import { describe, expect, it } from "vitest";
import {
  PHONE_OTP_SMS_NOT_CONFIGURED_MESSAGE,
  PHONE_OTP_SMS_PROVIDER_FAILED_MESSAGE,
  phoneOtpSmsFailureMessage,
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

  it("maps failure kinds to distinct messages", () => {
    expect(phoneOtpSmsFailureMessage("not_configured")).toBe(
      PHONE_OTP_SMS_NOT_CONFIGURED_MESSAGE,
    );
    expect(phoneOtpSmsFailureMessage("provider_failed")).toBe(
      PHONE_OTP_SMS_PROVIDER_FAILED_MESSAGE,
    );
    expect(phoneOtpSmsFailureMessage(undefined)).toBe(
      PHONE_OTP_SMS_NOT_CONFIGURED_MESSAGE,
    );
  });
});
