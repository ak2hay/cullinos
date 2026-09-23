/** Shared message when platform SMS OTP gate is active. */
export const SMS_OTP_TEMPORARILY_DISABLED_MESSAGE =
  "SMS OTP temporarily disabled by platform";

/**
 * True when `disabledUntilIso` is a parseable future timestamp.
 * Empty / invalid / past → OTP is enabled.
 */
export function isOtpTemporarilyDisabled(
  disabledUntilIso: string | undefined | null,
  nowMs: number = Date.now(),
): boolean {
  const raw = (disabledUntilIso ?? "").trim();
  if (!raw) return false;
  const until = Date.parse(raw);
  if (Number.isNaN(until)) return false;
  return until > nowMs;
}
