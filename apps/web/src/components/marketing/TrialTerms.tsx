import { TRIAL_TERMS } from '@cullinos/shared';

export function TrialTerms({ className = '' }: { className?: string }) {
  return <p className={`text-xs text-text-muted ${className}`}>{TRIAL_TERMS}</p>;
}
