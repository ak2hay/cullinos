export const REFUND_PIN_REQUIRED_CODE = "REFUND_PIN_REQUIRED";
export const REFUND_PIN_NOT_SET_CODE = "REFUND_PIN_NOT_SET";
export const REFUND_PIN_INVALID_CODE = "REFUND_PIN_INVALID";
export const REFUND_PIN_LOCKED_CODE = "REFUND_PIN_LOCKED";

export const REFUND_PIN_MAX_ATTEMPTS = 5;
export const REFUND_PIN_LOCK_MS = 15 * 60_000;

export function isValidRefundPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

export function isPinLocked(lockedUntil: Date | null | undefined, now: Date): boolean {
  return Boolean(lockedUntil && lockedUntil.getTime() > now.getTime());
}

/** Decide what happens after a wrong PIN, given the failure count including this attempt. */
export function pinFailureOutcome(failedAttempts: number): { lock: boolean; remaining: number } {
  const remaining = Math.max(0, REFUND_PIN_MAX_ATTEMPTS - failedAttempts);
  return { lock: remaining === 0, remaining };
}

export function lockMinutesLeft(lockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
}
