import { ForbiddenException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertTurnstile, isNativeTurnstileClient } from "./turnstile.util";

const ORIGINAL_SECRET = process.env.TURNSTILE_SECRET_KEY;
const ORIGINAL_EXEMPT = process.env.TURNSTILE_EXEMPT_NATIVE;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = ORIGINAL_SECRET;
  if (ORIGINAL_EXEMPT === undefined) delete process.env.TURNSTILE_EXEMPT_NATIVE;
  else process.env.TURNSTILE_EXEMPT_NATIVE = ORIGINAL_EXEMPT;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function browser(headers: Record<string, string> = {}) {
  return { headers: { "user-agent": "Mozilla/5.0 (compatible; browser)", ...headers } };
}

describe("assertTurnstile", () => {
  it("rejects a web request without a token when the secret is set", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-turnstile-secret";
    delete process.env.TURNSTILE_EXEMPT_NATIVE;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      assertTurnstile(undefined, "203.0.113.9", browser()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows a native request without a token when the secret is set", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-turnstile-secret";
    delete process.env.TURNSTILE_EXEMPT_NATIVE;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Installed guest APK 1.0.4: Dio default user agent, no captcha token, no X-Cullinos-Client.
    await expect(
      assertTurnstile(undefined, "203.0.113.9", {
        headers: { "user-agent": "Dart/3.5.4 (dart:io)" },
      }),
    ).resolves.toBeUndefined();

    await expect(
      assertTurnstile("", "203.0.113.9", {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Cullinos POS/0.1.0 Chrome/134.0.6998.205 Electron/35.7.5 Safari/537.36",
        },
      }),
    ).resolves.toBeUndefined();

    await expect(
      assertTurnstile(null, "203.0.113.9", {
        headers: {
          "user-agent": "Mozilla/5.0",
          "x-cullinos-client": "waiter-android",
        },
      }),
    ).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows a web request without a token when the secret is unset", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      assertTurnstile(undefined, "203.0.113.9", browser()),
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still rejects native clients when TURNSTILE_EXEMPT_NATIVE is false", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-turnstile-secret";
    process.env.TURNSTILE_EXEMPT_NATIVE = "false";

    await expect(
      assertTurnstile(undefined, "203.0.113.9", {
        headers: { "user-agent": "Dart/3.5.4 (dart:io)" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      assertTurnstile(undefined, "203.0.113.9", {
        headers: { "user-agent": "Mozilla/5.0", "x-cullinos-client": "pos-desktop" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not treat a browser user agent or an unknown client id as native", () => {
    expect(isNativeTurnstileClient(browser())).toBe(false);
    expect(
      isNativeTurnstileClient({
        headers: { "user-agent": "Mozilla/5.0", "x-cullinos-client": "admin" },
      }),
    ).toBe(false);
    expect(
      isNativeTurnstileClient({
        headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0" },
      }),
    ).toBe(false);
    expect(
      isNativeTurnstileClient({
        headers: { "x-cullinos-client": "guest-android" },
      }),
    ).toBe(true);
    expect(
      isNativeTurnstileClient({
        headers: { "x-cullinos-client": "kds-desktop" },
      }),
    ).toBe(true);
  });
});
