import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Crown, X } from 'lucide-react';
import type { OrganizationCurrent } from '@/lib/api';

const TOP_PLAN_SLUG = 'enterprise';
const SNOOZE_MS = 7 * 86_400_000;
/** The card comes back regardless of a snooze once the trial is this close to ending. */
const URGENT_TRIAL_DAYS = 3;

function trialDaysLeft(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : null;
}

function snoozeKey(orgId: string) {
  return `cullinos.upgradeCard.dismissedUntil.${orgId}`;
}

function readSnoozed(orgId: string): boolean {
  try {
    const until = Number(localStorage.getItem(snoozeKey(orgId)));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export function UpgradeCard({
  org,
  onNavigate,
}: {
  org: OrganizationCurrent | undefined;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  if (!org || org.planSlug === TOP_PLAN_SLUG) return null;
  const daysLeft = org.subscriptionStatus === 'trial' ? trialDaysLeft(org.trialEndsAt) : null;
  const urgent = daysLeft != null && daysLeft <= URGENT_TRIAL_DAYS;
  if (!urgent && (dismissedFor === org.id || readSnoozed(org.id))) return null;

  function dismiss() {
    if (!org) return;
    try {
      localStorage.setItem(snoozeKey(org.id), String(Date.now() + SNOOZE_MS));
    } catch {
      /* storage unavailable: hide for this session only */
    }
    setDismissedFor(org.id);
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-brand-primary/25 bg-gradient-to-br from-brand-primary/15 via-brand-primary/5 to-transparent p-4">
      {!urgent ? (
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('shell.upgrade.dismiss', 'Hide for 7 days')}
          title={t('shell.upgrade.dismiss', 'Hide for 7 days')}
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
        >
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
      <div className="flex items-center gap-2 pr-6">
        <Crown size={18} className="text-brand-primary" aria-hidden="true" />
        <p className="text-sm font-semibold text-text-primary">
          {t('shell.upgrade.title', 'Grow with Cullinos')}
        </p>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
        {daysLeft != null
          ? t('shell.upgrade.trial', {
              count: daysLeft,
              defaultValue: 'Your trial ends in {{count}} days. Pick a plan to keep going.',
            })
          : t('shell.upgrade.body', 'Unlock advanced features for multi-outlet and central kitchen.')}
      </p>
      <Link
        to="/billing"
        onClick={onNavigate}
        className="group mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-primary-dark"
      >
        {t('shell.upgrade.cta', 'Upgrade plan')}
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
