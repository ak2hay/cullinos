import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Crown } from 'lucide-react';
import type { OrganizationCurrent } from '@/lib/api';

const TOP_PLAN_SLUG = 'enterprise';

function trialDaysLeft(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : null;
}

export function UpgradeCard({
  org,
  onNavigate,
}: {
  org: OrganizationCurrent | undefined;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  if (!org || org.planSlug === TOP_PLAN_SLUG) return null;
  const daysLeft = org.subscriptionActive ? null : trialDaysLeft(org.trialEndsAt);

  return (
    <div className="relative overflow-hidden rounded-xl border border-brand-primary/25 bg-gradient-to-br from-brand-primary/15 via-brand-primary/5 to-transparent p-4">
      <div className="flex items-center gap-2">
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
