'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ALL_COMPARISON_FEATURES,
  FEATURE_LABELS,
  formatInr,
  MARKETING_PLANS,
  type MarketingPlan,
} from '@cullinos/shared';
import { getRegisterUrl } from '@/lib/urls';

export function PricingTable() {
  const [yearly, setYearly] = useState(false);

  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setYearly(false)}
          className={`rounded-lg px-4 py-2 text-sm ${!yearly ? 'bg-brand-primary text-bg-primary' : 'text-text-secondary'}`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setYearly(true)}
          className={`rounded-lg px-4 py-2 text-sm ${yearly ? 'bg-brand-primary text-bg-primary' : 'text-text-secondary'}`}
        >
          Yearly
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {MARKETING_PLANS.map((plan) => (
          <PricingCard key={plan.key} plan={plan} yearly={yearly} />
        ))}
      </div>

      <div className="mt-12 overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-bg-secondary">
              <th className="px-4 py-3 font-medium text-text-secondary">Feature</th>
              {MARKETING_PLANS.map((plan) => (
                <th key={plan.key} className="px-4 py-3 font-medium">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_COMPARISON_FEATURES.map((feature) => (
              <tr key={feature} className="border-b border-white/5">
                <td className="px-4 py-3 text-text-secondary">{FEATURE_LABELS[feature]}</td>
                {MARKETING_PLANS.map((plan) => (
                  <td key={plan.key} className="px-4 py-3">
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

function PricingCard({ plan, yearly }: { plan: MarketingPlan; yearly: boolean }) {
  const price = yearly ? plan.priceYearly : plan.priceMonthly;
  const period = yearly ? '/year' : '/month';
  const ctaHref = plan.cta === 'register' ? getRegisterUrl() : '/contact?plan=' + plan.key.toLowerCase();

  return (
    <article
      className={`rounded-xl border p-6 ${plan.highlighted ? 'border-brand-primary bg-bg-card' : 'border-white/5 bg-bg-secondary'}`}
    >
      {plan.highlighted && (
        <span className="mb-3 inline-block rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs text-brand-primary">
          Most popular
        </span>
      )}
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-text-secondary">{plan.description}</p>
      <p className="mt-4 text-3xl font-semibold">
        {formatInr(price)}
        <span className="text-sm font-normal text-text-muted">{period}</span>
      </p>
      <ul className="mt-4 space-y-2 text-sm text-text-secondary">
        <li>{plan.maxOutlets} outlet{plan.maxOutlets > 1 ? 's' : ''}</li>
        <li>{plan.maxUsers} users</li>
        <li>{plan.maxTerminals} terminals</li>
      </ul>
      <Link
        href={ctaHref}
        className={`mt-6 block rounded-lg px-4 py-2 text-center text-sm font-medium transition ${
          plan.highlighted
            ? 'bg-brand-primary text-bg-primary hover:bg-brand-primary-dark'
            : 'border border-white/10 hover:border-brand-primary/50'
        }`}
      >
        {plan.cta === 'register' ? 'Start free trial' : 'Contact sales'}
      </Link>
    </article>
  );
}

export function PricingTeaser() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {MARKETING_PLANS.map((plan) => (
        <div key={plan.key} className="rounded-xl border border-white/5 bg-bg-card p-5">
          <h3 className="font-semibold">{plan.name}</h3>
          <p className="mt-2 text-2xl font-semibold text-brand-primary">
            {formatInr(plan.priceMonthly)}
            <span className="text-sm font-normal text-text-muted">/mo</span>
          </p>
        </div>
      ))}
    </div>
  );
}
