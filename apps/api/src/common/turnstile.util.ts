import { ForbiddenException, Logger } from "@nestjs/common";

const logger = new Logger("Turnstile");

/**
 * Verify Cloudflare Turnstile token.
 * When TURNSTILE_SECRET_KEY is unset, verification is skipped (local/dev).
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  ip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    logger.warn("TURNSTILE_SECRET_KEY not set — skipping verification (dev only)");
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
): Promise<void> {
  const ok = await verifyTurnstileToken(token, ip);
  if (!ok) {
    throw new ForbiddenException("Captcha verification failed. Please try again.");
  }
}
