'use client';

import type { MarketingCmsBundle } from '@cullinos/shared';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ALL_COMPARISON_FEATURES,
  FEATURE_LABELS,
  formatInr,
  MARKETING_PLANS,
  type MarketingPlan,
} from '@cullinos/shared';
import { useMarketingCms } from '@/components/marketing/MarketingCmsProvider';
import { getRegisterUrl } from '@/lib/urls';

type DisplayPlan = MarketingPlan & { id: string };

function cmsCardToPlan(card: MarketingCmsBundle['pricingCards'][number]): DisplayPlan {
  return {
    id: card.id,
    key: card.planKey as MarketingPlan['key'],
    name: card.name,
    description: card.description,
    priceMonthly: card.priceMonthly,
    priceYearly: card.priceYearly,
    maxOutlets: card.maxOutlets,
    maxUsers: card.maxUsers,
    maxTerminals: card.maxTerminals,
    features: card.features as MarketingPlan['features'],
    cta: card.cta as MarketingPlan['cta'],
    highlighted: card.highlighted,
  };
}

export function PricingTable() {
  const cms = useMarketingCms();
  const registerUrl = cms.site?.registerUrl || getRegisterUrl();
  const plans = useMemo(() => {
    if (cms.pricingCards.length) {
      return [...cms.pricingCards]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(cmsCardToPlan);
    }
    return MARKETING_PLANS.map((p) => ({ ...p, id: p.key }));
  }, [cms.pricingCards]);

  const [yearly, setYearly] = useState(false);

  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setYearly(false)}
          className={`rounded-full px-5 py-2 text-sm transition ${
            !yearly ? 'bg-bg-dark text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setYearly(true)}
          className={`rounded-full px-5 py-2 text-sm transition ${
            yearly ? 'bg-bg-dark text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Yearly
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {plans.map((plan) => (
          <PricingCard key={plan.id} plan={plan} yearly={yearly} registerUrl={registerUrl} />
        ))}
      </div>

      <div className="mt-12 overflow-x-auto rounded-2xl border border-border-light bg-bg-card shadow-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-light bg-bg-elevated">
              <th className="px-4 py-3 font-medium text-text-secondary">Feature</th>
              {plans.map((plan) => (
                <th key={plan.id} className="px-4 py-3 font-serif font-medium">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_COMPARISON_FEATURES.map((feature) => (
              <tr key={feature} className="border-b border-border-light">
                <td className="px-4 py-3 text-text-secondary">{FEATURE_LABELS[feature]}</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-4 py-3">
                    {plan.features.includes(feature) ? (
                      <span className="text-status-success">✓</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PricingCard({
  plan,
  yearly,
  registerUrl,
}: {
  plan: DisplayPlan;
  yearly: boolean;
  registerUrl: string;
}) {
  const price = yearly ? plan.priceYearly : plan.priceMonthly;
  const period = yearly ? '/year' : '/month';
  const ctaHref = plan.cta === 'register' ? registerUrl : '/contact?plan=' + plan.key.toLowerCase();

  return (
    <article
      className={`rounded-2xl border p-6 shadow-card ${
        plan.highlighted
          ? 'border-brand-gold bg-bg-card ring-1 ring-brand-gold/30'
          : 'border-border-light bg-bg-card'
      }`}
    >
      {plan.highlighted && (
        <span className="mb-3 inline-block rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-brand-gold">
          Most popular
        </span>
      )}
      <h3 className="font-serif text-lg font-medium">{plan.name}</h3>
      <p className="mt-1 text-sm text-text-secondary">{plan.description}</p>
      <p className="mt-4 font-serif text-3xl font-medium">
        {formatInr(price)}
        <span className="text-sm font-normal text-text-muted">{period}</span>
      </p>
      <ul className="mt-4 space-y-2 text-sm text-text-secondary">
        <li>
          {plan.maxOutlets} outlet{plan.maxOutlets > 1 ? 's' : ''}
        </li>
        <li>{plan.maxUsers} users</li>
        <li>{plan.maxTerminals} terminals</li>
      </ul>
      <Link
        href={ctaHref}
        className={`mt-6 block text-center ${plan.highlighted ? 'btn-pill-filled btn-pill' : 'btn-pill'}`}
      >
        {plan.cta === 'register' ? 'Start free trial' : 'Contact sales'}
      </Link>
    </article>
  );
}

export function PricingTeaser() {
  const cms = useMarketingCms();
  const plans = useMemo(() => {
    if (cms.pricingCards.length) {
      return [...cms.pricingCards].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return MARKETING_PLANS.map((p, i) => ({
      id: p.key,
      name: p.name,
      priceMonthly: p.priceMonthly,
      sortOrder: i,
    }));
  }, [cms.pricingCards]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => (
        <div key={plan.id} className="rounded-2xl border border-border-light bg-bg-card p-5 shadow-card">
          <h3 className="font-serif font-medium">{plan.name}</h3>
          <p className="mt-2 font-serif text-2xl font-medium text-brand-gold">
            {formatInr(plan.priceMonthly)}
            <span className="text-sm font-normal text-text-muted">/mo</span>
          </p>
        </div>
      ))}
    </div>
  );
}
