import { describe, expect, it } from "vitest";
import { DEFAULT_TRIAL_DAYS } from "@cullinos/shared";
import { assertTrialEnd, resolveTrialEnd } from "./trial.util";

const now = new Date("2026-10-11T00:00:00.000Z");
const DAY = 86_400_000;

describe("resolveTrialEnd", () => {
  it("defaults to DEFAULT_TRIAL_DAYS (30)", () => {
    expect(DEFAULT_TRIAL_DAYS).toBe(30);
    expect(resolveTrialEnd({}, now).getTime()).toBe(now.getTime() + 30 * DAY);
  });

  it("honours trialDays", () => {
    expect(resolveTrialEnd({ trialDays: 7 }, now).getTime()).toBe(now.getTime() + 7 * DAY);
  });

  it("prefers an explicit trialEndsAt", () => {
    const end = new Date(now.getTime() + 45 * DAY);
    expect(resolveTrialEnd({ trialDays: 7, trialEndsAt: end }, now)).toEqual(end);
  });
});

describe("assertTrialEnd", () => {
  it("rejects past dates", () => {
    expect(() => assertTrialEnd(new Date(now.getTime() - DAY), now)).toThrow(/future/);
  });

  it("rejects dates beyond a year", () => {
    expect(() => assertTrialEnd(new Date(now.getTime() + 400 * DAY), now)).toThrow(/365/);
  });

  it("accepts ISO strings", () => {
    expect(assertTrialEnd("2026-12-01T00:00:00.000Z", now).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
});
