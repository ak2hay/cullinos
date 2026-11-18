import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import cors from "cors";
import express from "express";
import {
  assertProductionSecurityConfig,
  CorsOriginRejectedError,
  createCorsOriginDelegate,
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

  it("allows production without TURNSTILE_SECRET_KEY (captcha disabled)", () => {
    expect(() =>
      assertProductionSecurityConfig({
        ...validProd,
        TURNSTILE_SECRET_KEY: "",
      }),
    ).not.toThrow();
  });

  it("fails production when TURNSTILE_SECRET_KEY is a placeholder", () => {
    expect(() =>
      assertProductionSecurityConfig({
        ...validProd,
        TURNSTILE_SECRET_KEY: "change-me-turnstile-secret",
      }),
    ).toThrow(/TURNSTILE_SECRET_KEY/);
  });

  it("allows valid production config", () => {
    expect(() => assertProductionSecurityConfig(validProd)).not.toThrow();
  });

  it("allows listed and missing origins", () => {
    const delegate = createCorsOriginDelegate(new Set(["https://admin.example.com"]));
    const listed = viCallback();
    delegate("https://admin.example.com", listed.fn);
    expect(listed.calls).toEqual([[null, true]]);

    const missing = viCallback();
    delegate(undefined, missing.fn);
    expect(missing.calls).toEqual([[null, true]]);
  });

  it("rejects an unknown origin with 403 instead of a generic error", () => {
    const delegate = createCorsOriginDelegate(new Set(["https://admin.example.com"]));
    const rejected = viCallback();
    delegate("https://evil.example", rejected.fn);
    expect(rejected.calls).toHaveLength(1);
    const [err, allow] = rejected.calls[0];
    expect(allow).toBeUndefined();
    expect(err).toBeInstanceOf(CorsOriginRejectedError);
    expect((err as CorsOriginRejectedError).status).toBe(403);
    expect((err as CorsOriginRejectedError).statusCode).toBe(403);
    expect((err as Error).message).toBe("Origin not allowed");
  });

  it("responds 403 with no CORS headers for an unknown Origin", async () => {
    const app = express();
    app.use(
      cors({
        credentials: true,
        origin: createCorsOriginDelegate(new Set(["https://admin.example.com"])),
      }),
    );
    app.get("/ping", (_req, res) => {
      res.json({ ok: true });
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const denied = await fetch(`http://127.0.0.1:${port}/ping`, {
        headers: { Origin: "https://evil.example" },
      });
      expect(denied.status).toBe(403);
      expect(denied.headers.get("access-control-allow-origin")).toBeNull();
      expect(denied.headers.get("access-control-allow-credentials")).toBeNull();

      const allowed = await fetch(`http://127.0.0.1:${port}/ping`, {
        headers: { Origin: "https://admin.example.com" },
      });
      expect(allowed.status).toBe(200);
      expect(allowed.headers.get("access-control-allow-origin")).toBe(
        "https://admin.example.com",
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});

function viCallback() {
  const calls: Array<[Error | null, boolean | undefined]> = [];
  return {
    calls,
    fn: (err: Error | null, allow?: boolean) => {
      calls.push([err, allow]);
    },
  };
}
