/** Length applied only when a new tenant is provisioned. Existing subscriptions are not rewritten. */
export const DEFAULT_TRIAL_DAYS = 30;

export const TRIAL_CTA_LABEL = 'Start 30-day free trial';

/** Signup collects restaurant, name, email, and mobile. Razorpay starts when a paid plan is chosen. */
export const TRIAL_TERMS = '30-day free trial · no card needed';

export function resolveTrialDays(override?: number | null): number {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return Math.round(override);
  }
  return DEFAULT_TRIAL_DAYS;
}

export function trialEndDate(now: Date, trialDays = DEFAULT_TRIAL_DAYS): Date {
  return new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
}
