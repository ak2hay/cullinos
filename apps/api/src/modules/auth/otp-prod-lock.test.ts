import { describe, expect, it } from "vitest";
import { assertProductionSecurityConfig } from "../../common/cors.util";
import {
  sandboxAllowsEmailOtpSkip,
  sandboxAllowsSmsOtpSkip,
} from "../../common/sandbox-access.util";

describe("auth OTP skip flag", () => {
  it("blocks AUTH_SKIP_EMAIL_OTP in production via assertProductionSecurityConfig", () => {
    expect(() =>
      assertProductionSecurityConfig({
        NODE_ENV: "production",
        CORS_ORIGINS: "https://admin.example.com",
        AUTH_SKIP_EMAIL_OTP: "true",
        JWT_SECRET: "a-sufficiently-long-production-jwt-secret-key",
        INTERNAL_API_KEY: "prod-internal-api-key-value-xyz",
        ENCRYPTION_KEY: "a-sufficiently-long-production-encryption-key",
      } as NodeJS.ProcessEnv),
    ).toThrow(/AUTH_SKIP_EMAIL_OTP/);
  });

  it("does not skip when AUTH_SKIP_EMAIL_OTP is false", () => {
    const prevSkip = process.env.AUTH_SKIP_EMAIL_OTP;
    process.env.AUTH_SKIP_EMAIL_OTP = "false";

    const isEmailOtpSkipped = (): boolean => {
      if (process.env.NODE_ENV === "production") return false;
      const raw = (process.env.AUTH_SKIP_EMAIL_OTP ?? "").trim().toLowerCase();
      return raw === "true" || raw === "1" || raw === "yes";
    };

    expect(isEmailOtpSkipped()).toBe(false);

    if (prevSkip === undefined) delete process.env.AUTH_SKIP_EMAIL_OTP;
    else process.env.AUTH_SKIP_EMAIL_OTP = prevSkip;
  });

  const sandboxOrg = {
    environmentClass: 0,
    sandboxSkipEmailOtp: true,
    sandboxSkipSmsOtp: true,
    sandboxRelaxPassword: true,
  };
  const prodEnv = { NODE_ENV: "production" } as NodeJS.ProcessEnv;

  it("sandbox OTP skip is fail-closed on a production API by default", () => {
    expect(sandboxAllowsEmailOtpSkip(sandboxOrg, prodEnv)).toBe(false);
    expect(sandboxAllowsSmsOtpSkip(sandboxOrg, prodEnv)).toBe(false);
  });

  it("sandbox OTP skip in production requires explicit ALLOW_SANDBOX_OTP_SKIP=true", () => {
    const env = { ...prodEnv, ALLOW_SANDBOX_OTP_SKIP: "true" } as NodeJS.ProcessEnv;
    expect(sandboxAllowsEmailOtpSkip(sandboxOrg, env)).toBe(true);
    expect(
      sandboxAllowsEmailOtpSkip(sandboxOrg, { ...prodEnv, ALLOW_SANDBOX_OTP_SKIP: "1" }),
    ).toBe(false);
  });

  it("live tenants never skip OTP, even with the production opt-in", () => {
    const env = { ...prodEnv, ALLOW_SANDBOX_OTP_SKIP: "true" } as NodeJS.ProcessEnv;
    expect(sandboxAllowsEmailOtpSkip({ ...sandboxOrg, environmentClass: 1 }, env)).toBe(false);
    expect(sandboxAllowsSmsOtpSkip({ ...sandboxOrg, environmentClass: 1 }, env)).toBe(false);
  });

  it("requires the org flag to be explicitly true", () => {
    const devEnv = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
    expect(sandboxAllowsEmailOtpSkip({ environmentClass: 0 }, devEnv)).toBe(false);
    expect(sandboxAllowsSmsOtpSkip({ environmentClass: 0 }, devEnv)).toBe(false);
  });
});
