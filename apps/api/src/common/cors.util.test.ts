import { describe, expect, it } from "vitest";
import {
  assertProductionSecurityConfig,
  parseCorsOrigins,
} from "./cors.util";

const validProd = {
  NODE_ENV: "production",
  CORS_ORIGINS: "https://admin.example.com",
  AUTH_SKIP_EMAIL_OTP: "false",
  JWT_SECRET: "a-sufficiently-long-production-jwt-secret-key",
  SUPER_ADMIN_JWT_SECRET: "a-separate-strong-super-admin-signing-secret",
  INTERNAL_API_KEY: "prod-internal-api-key-value-xyz",
  ENCRYPTION_KEY: "a-sufficiently-long-production-encryption-key",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAAprod-turnstile-secret",
} as NodeJS.ProcessEnv;

describe("cors.util", () => {
  it("parses comma-separated origins", () => {
    expect(parseCorsOrigins(" https://a.com ,https://b.com ")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("fails production when CORS_ORIGINS is missing", () => {
    expect(() =>
      assertProductionSecurityConfig({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    ).toThrow(/CORS_ORIGINS/);
  });

  it("fails production when CORS contains wildcard", () => {
    expect(() =>
      assertProductionSecurityConfig({
        NODE_ENV: "production",
        CORS_ORIGINS: "*",
      } as NodeJS.ProcessEnv),
    ).toThrow(/wildcard/);
  });

  it("fails production when AUTH_SKIP_EMAIL_OTP is enabled", () => {
    expect(() =>
      assertProductionSecurityConfig({
        ...validProd,
        AUTH_SKIP_EMAIL_OTP: "true",
      }),
    ).toThrow(/AUTH_SKIP_EMAIL_OTP/);
  });

  it("fails production when JWT_SECRET is a placeholder", () => {
    expect(() =>
      assertProductionSecurityConfig({
        ...validProd,
        JWT_SECRET: "change-me-min-32-chars-but-placeholder",
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it("fails production when JWT_SECRET is too short", () => {
    expect(() =>
      assertProductionSecurityConfig({
        ...validProd,
        JWT_SECRET: "short-but-not-placeholder",
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it("fails production when SUPER_ADMIN_JWT_SECRET is missing or reuses JWT_SECRET", () => {
    expect(() =>
      assertProductionSecurityConfig({ ...validProd, SUPER_ADMIN_JWT_SECRET: "" }),
    ).toThrow(/SUPER_ADMIN_JWT_SECRET/);
    expect(() =>
      assertProductionSecurityConfig({
        ...validProd,
        SUPER_ADMIN_JWT_SECRET: validProd.JWT_SECRET,
      }),
    ).toThrow(/SUPER_ADMIN_JWT_SECRET/);
  });

  it("fails production when INTERNAL_API_KEY is a placeholder", () => {
    expect(() =>
      assertProductionSecurityConfig({
        ...validProd,
        INTERNAL_API_KEY: "change-me-internal-provision-key",
      }),
    ).toThrow(/INTERNAL_API_KEY/);
  });

  it("fails production when ENCRYPTION_KEY is missing", () => {
    expect(() =>
      assertProductionSecurityConfig({
        ...validProd,
        ENCRYPTION_KEY: "",
      }),
    ).toThrow(/ENCRYPTION_KEY/);
  });

  it("fails production when TURNSTILE_SECRET_KEY is missing", () => {
    expect(() =>
      assertProductionSecurityConfig({
        ...validProd,
        TURNSTILE_SECRET_KEY: "",
      }),
    ).toThrow(/TURNSTILE_SECRET_KEY/);
  });

  it("allows valid production config", () => {
    expect(() => assertProductionSecurityConfig(validProd)).not.toThrow();
  });
});
