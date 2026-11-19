import { ForbiddenException, Logger } from "@nestjs/common";
import type { IncomingHttpHeaders } from "node:http";

const logger = new Logger("Turnstile");
let warnedDisabled = false;

/**
 * Explicit ids new native builds send as `X-Cullinos-Client`.
 * Installed apps do not send this header; see {@link isNativeTurnstileClient}.
 */
export const NATIVE_TURNSTILE_CLIENTS = new Set([
  "guest-android",
  "waiter-android",
  "pos-desktop",
  "kds-desktop",
]);

export const CULLINOS_CLIENT_HEADER = "x-cullinos-client";

export type TurnstileRequest = {
  headers?: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
};

function headerValue(
  headers: TurnstileRequest["headers"],
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const raw = headers[name] ?? headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Native exemption is on unless TURNSTILE_EXEMPT_NATIVE is explicitly disabled.
 * Unset, empty, "true", "1", and "yes" all keep it on so a missing VM env var
 * does not lock out installed apps.
 */
export function turnstileExemptsNativeClients(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env.TURNSTILE_EXEMPT_NATIVE ?? "").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "no" && raw !== "off";
}

/**
 * True when the request is clearly from a Cullinos native client.
 *
 * Installed Flutter APKs (guest 1.0.4 and the waiter app) use Dio on dart:io.
 * That client sends `User-Agent: Dart/<version> (dart:io)` and no captcha token.
 * Installed Electron POS/KDS builds load `file://` and send a Chromium user
 * agent containing `Electron/<version>`. Neither sends `X-Cullinos-Client`
 * until it is rebuilt. New builds send that header as well.
 *
 * Browser portals and the marketing site send a normal browser user agent and
 * do not send this header, so they stay enforced. Skipping captcha does not
 * skip the per-IP throttles on these routes.
 */
export function isNativeTurnstileClient(req?: TurnstileRequest): boolean {
  const client = headerValue(req?.headers, CULLINOS_CLIENT_HEADER)?.toLowerCase();
  if (client && NATIVE_TURNSTILE_CLIENTS.has(client)) return true;

  const ua = headerValue(req?.headers, "user-agent") ?? "";
  if (/^Dart\//i.test(ua)) return true;
  if (/\bElectron\//i.test(ua)) return true;
  return false;
}

/**
 * Verify Cloudflare Turnstile token.
 * When TURNSTILE_SECRET_KEY is unset, captcha is disabled and verification is skipped.
 * Clients only render the widget when built with a site key, so enforcing without one
 * would lock everyone out. Native clients are skipped while the exemption is on
 * (see {@link isNativeTurnstileClient}).
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  ip?: string,
  req?: TurnstileRequest,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (!warnedDisabled) {
      warnedDisabled = true;
      logger.warn("TURNSTILE_SECRET_KEY not set — captcha verification disabled");
    }
    return true;
  }
  if (turnstileExemptsNativeClients() && isNativeTurnstileClient(req)) {
    return true;
  }
  if (!token?.trim()) return false;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());
  if (ip && ip !== "unknown") {
    body.set("remoteip", ip.split(",")[0]?.trim() ?? ip);
  }

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch (err) {
    logger.warn(`Turnstile verify failed: ${err}`);
    return false;
  }
}

export async function assertTurnstile(
  token: string | undefined | null,
  ip?: string,
  req?: TurnstileRequest,
): Promise<void> {
  const ok = await verifyTurnstileToken(token, ip, req);
  if (!ok) {
    throw new ForbiddenException("Captcha verification failed. Please try again.");
  }
}
