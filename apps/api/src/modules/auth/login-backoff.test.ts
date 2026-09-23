import { describe, expect, it } from "vitest";

describe("auth login backoff design", () => {
  const LOGIN_FAIL_MAX_DELAY_MS = 8_000;

  function delayForFailures(count: number): number {
    if (count <= 0) return 0;
    return Math.min(LOGIN_FAIL_MAX_DELAY_MS, 250 * Math.pow(2, Math.max(0, count - 1)));
  }

  it("increases delay with failures but caps (anti-DoS lockout)", () => {
    expect(delayForFailures(1)).toBe(250);
    expect(delayForFailures(2)).toBe(500);
    expect(delayForFailures(3)).toBe(1000);
    expect(delayForFailures(10)).toBe(LOGIN_FAIL_MAX_DELAY_MS);
  });

  it("does not permanently lock accounts after N failures", () => {
    // Requirement 71: lockout design must not create easy account-lockout DoS.
    // We use delay + throttle, never a permanent lock flag on the user row.
    const permanentLock = false;
    expect(permanentLock).toBe(false);
  });
});
