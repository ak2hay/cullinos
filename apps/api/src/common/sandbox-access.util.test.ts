import { describe, it, expect } from "vitest";
import {
  TENANT_ENV_LIVE,
  TENANT_ENV_SANDBOX,
  assertPasswordLength,
  isSandboxTenant,
  passwordMinLength,
  sandboxAllowsEmailOtpSkip,
  sandboxAllowsRelaxedPassword,
  sandboxAllowsSmsOtpSkip,
} from "./sandbox-access.util";

describe("sandbox-access.util", () => {
  const sandbox = {
    environmentClass: TENANT_ENV_SANDBOX,
    sandboxSkipEmailOtp: true,
    sandboxSkipSmsOtp: true,
    sandboxRelaxPassword: true,
  };
  const live = {
    environmentClass: TENANT_ENV_LIVE,
    sandboxSkipEmailOtp: true,
    sandboxSkipSmsOtp: true,
    sandboxRelaxPassword: true,
  };

  it("identifies sandbox vs live", () => {
    expect(isSandboxTenant(sandbox)).toBe(true);
    expect(isSandboxTenant(live)).toBe(false);
    expect(isSandboxTenant(null)).toBe(false);
  });

  it("ignores sandbox flags on live tenants", () => {
    expect(sandboxAllowsEmailOtpSkip(live)).toBe(false);
    expect(sandboxAllowsSmsOtpSkip(live)).toBe(false);
    expect(sandboxAllowsRelaxedPassword(live)).toBe(false);
  });

  it("honors sandbox flags when environment is sandbox", () => {
    expect(sandboxAllowsEmailOtpSkip(sandbox)).toBe(true);
    expect(sandboxAllowsSmsOtpSkip(sandbox)).toBe(true);
    expect(sandboxAllowsRelaxedPassword(sandbox)).toBe(true);
    expect(
      sandboxAllowsEmailOtpSkip({
        ...sandbox,
        sandboxSkipEmailOtp: false,
      }),
    ).toBe(false);
  });

  it("relaxes password min length for sandbox", () => {
    expect(passwordMinLength(sandbox)).toBe(6);
    expect(passwordMinLength(live)).toBe(8);
    expect(assertPasswordLength("abcdef", sandbox)).toBeNull();
    expect(assertPasswordLength("abcdef", live)).toMatch(/8–128/);
  });
});
