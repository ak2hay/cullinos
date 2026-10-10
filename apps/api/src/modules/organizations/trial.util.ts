import { BadRequestException } from "@nestjs/common";
import { DEFAULT_TRIAL_DAYS, MAX_TRIAL_DAYS } from "@cullinos/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Trial end for a new tenant: explicit date, else `trialDays`, else the platform default. */
export function resolveTrialEnd(
  input: { trialDays?: number; trialEndsAt?: Date },
  now: Date = new Date(),
): Date {
  if (input.trialEndsAt) return assertTrialEnd(input.trialEndsAt, now);
  const days =
    input.trialDays && input.trialDays > 0 ? Math.round(input.trialDays) : DEFAULT_TRIAL_DAYS;
  return new Date(now.getTime() + Math.min(days, MAX_TRIAL_DAYS) * DAY_MS);
}

/** Validates a super-admin chosen trial end: in the future and within MAX_TRIAL_DAYS. */
export function assertTrialEnd(value: Date | string, now: Date = new Date()): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new BadRequestException("Invalid trial end date");
  if (d.getTime() <= now.getTime()) {
    throw new BadRequestException("Trial end date must be in the future");
  }
  if (d.getTime() > now.getTime() + MAX_TRIAL_DAYS * DAY_MS) {
    throw new BadRequestException(`Trial cannot run more than ${MAX_TRIAL_DAYS} days from today`);
  }
  return d;
}
