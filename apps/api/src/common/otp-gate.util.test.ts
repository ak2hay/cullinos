import { describe, expect, it } from "vitest";
import {
  isOtpTemporarilyDisabled,
  SMS_OTP_TEMPORARILY_DISABLED_MESSAGE,
} from "./otp-gate.util";

describe("isOtpTemporarilyDisabled", () => {
  const now = Date.parse("2026-09-24T12:00:00.000Z");

  it("returns false for empty / null / undefined", () => {
    expect(isOtpTemporarilyDisabled(undefined, now)).toBe(false);
    expect(isOtpTemporarilyDisabled(null, now)).toBe(false);
    expect(isOtpTemporarilyDisabled("", now)).toBe(false);
    expect(isOtpTemporarilyDisabled("   ", now)).toBe(false);
  });

  it("returns false for invalid timestamps", () => {
    expect(isOtpTemporarilyDisabled("not-a-date", now)).toBe(false);
  });

  it("returns false when until is in the past", () => {
    expect(isOtpTemporarilyDisabled("2026-09-24T11:59:59.000Z", now)).toBe(false);
  });

  it("returns false when until equals now", () => {
    expect(isOtpTemporarilyDisabled("2026-09-24T12:00:00.000Z", now)).toBe(false);
  });

  it("returns true when until is in the future", () => {
    expect(isOtpTemporarilyDisabled("2026-09-24T12:15:00.000Z", now)).toBe(true);
  });

  it("exports a stable SMS disable message", () => {
    expect(SMS_OTP_TEMPORARILY_DISABLED_MESSAGE).toMatch(/temporarily disabled/i);
  });
});
