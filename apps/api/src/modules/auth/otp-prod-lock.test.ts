import { describe, expect, it } from "vitest";
import { assertProductionSecurityConfig } from "../../common/cors.util";
import { sandboxAllowsEmailOtpSkip } from "../../common/sandbox-access.util";

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

  it("sandbox org can skip email OTP even in production", () => {
    const org = {
      environmentClass: 0,
      sandboxSkipEmailOtp: true,
      sandboxSkipSmsOtp: true,
      sandboxRelaxPassword: true,
    };
    expect(sandboxAllowsEmailOtpSkip(org)).toBe(true);
    expect(
      sandboxAllowsEmailOtpSkip({ ...org, environmentClass: 1 }),
    ).toBe(false);
  });
});
