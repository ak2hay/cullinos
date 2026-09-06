import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BUSINESS_TYPE_PARENT_LABELS,
  BUSINESS_TYPE_PARENTS,
  FEATURE_LABELS,
  QSR_SUBTYPE_LABELS,
  QSR_SUBTYPES,
  RESTAURANT_SIZE_LABELS,
  RESTAURANT_SIZES,
  getBusinessTypeParent,
  getFeaturesForProfile,
  resolveBusinessTypeFromParent,
  type BusinessType,
  type BusinessTypeParent,
  type OnboardingStep,
  type QsrSubtype,
  type RestaurantSize,
} from '@cullinos/shared';
import { outletsApi, settingsApi } from '@/lib/api';

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'America/New_York',
] as const;

const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SGD'] as const;

const STEP_TITLES: Partial<Record<OnboardingStep, string>> = {
  business_info: 'Business details',
  feature_preview: 'Your features',
  menu_setup: 'Menu categories',
  tables: 'Tables',
  tax_gst: 'Tax & GST',
  staff: 'Staff',
  recipes: 'Recipes',
  done: 'Ready',
};

export function OnboardingWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [parentType, setParentType] = useState<BusinessTypeParent>('restaurant');
  const [qsrSubtype, setQsrSubtype] = useState<QsrSubtype>('cafe');
  const [restaurantSize, setRestaurantSize] = useState<RestaurantSize>('medium');
  const [businessName, setBusinessName] = useState('');
  const [gstin, setGstin] = useState('');
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
  const [currency, setCurrency] = useState<string>('INR');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const businessType: BusinessType = useMemo(
    () => resolveBusinessTypeFromParent(parentType, qsrSubtype),
    [parentType, qsrSubtype],
  );

  const sizeForProfile = parentType === 'restaurant' ? restaurantSize : null;
  const profile = useMemo(
    () => getFeaturesForProfile(businessType, sizeForProfile),
    [businessType, sizeForProfile],
  );

  const steps = profile.onboardingSteps;
  const currentStep = steps[stepIndex] ?? 'business_info';
  const isLast = stepIndex >= steps.length - 1;

  function handleParentChange(next: BusinessTypeParent) {
    setParentType(next);
    if (next === 'qsr' && getBusinessTypeParent(businessType) !== 'qsr') {
      setQsrSubtype('cafe');
    }
  }

  function goNext() {
    if (currentStep === 'business_info' && !businessName.trim()) {
      setSaveError('Business name is required.');
      return;
    }
    setSaveError(null);
    if (isLast) {
      void handleComplete();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function goBack() {
    setSaveError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleComplete() {
    setSaving(true);
    setSaveError(null);
    try {
      await settingsApi.update({
        businessType,
        restaurantSize: parentType === 'restaurant' ? restaurantSize : null,
        name: businessName.trim(),
        gstin: gstin.trim() || undefined,
        timezone,
        currency,
        operatingMode: profile.operatingMode,
        enabledOrderTypes: profile.enabledOrderTypes,
        sampleCategories: profile.sampleCategories,
        setupCompleted: true,
      });

      const outlets = await outletsApi.list();
      await Promise.all(
        outlets.map((outlet) =>
          outletsApi.update(outlet.id, { operatingMode: profile.operatingMode }),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ['organizations', 'current'] });
      navigate('/');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save setup. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Restaurant setup</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Step {stepIndex + 1} of {steps.length}: {STEP_TITLES[currentStep] ?? currentStep}
        </p>
        <div className="mt-3 flex gap-1">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-brand-primary' : 'bg-white/10'}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-5 sm:p-8">
        {currentStep === 'business_info' ? (
          <>
            <label className="block">
              <span className="text-sm text-text-secondary">Business category</span>
              <select
                value={parentType}
                onChange={(e) => handleParentChange(e.target.value as BusinessTypeParent)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
              >
                {BUSINESS_TYPE_PARENTS.map((parent) => (
                  <option key={parent} value={parent}>
                    {BUSINESS_TYPE_PARENT_LABELS[parent]}
                  </option>
                ))}
              </select>
            </label>

            {parentType === 'restaurant' ? (
              <label className="block">
                <span className="text-sm text-text-secondary">Restaurant size</span>
                <select
                  value={restaurantSize}
                  onChange={(e) => setRestaurantSize(e.target.value as RestaurantSize)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
                >
                  {RESTAURANT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {RESTAURANT_SIZE_LABELS[size]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {parentType === 'qsr' ? (
              <label className="block">
                <span className="text-sm text-text-secondary">QSR subcategory</span>
                <select
                  value={qsrSubtype}
                  onChange={(e) => setQsrSubtype(e.target.value as QsrSubtype)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
                >
                  {QSR_SUBTYPES.map((sub) => (
                    <option key={sub} value={sub}>
                      {QSR_SUBTYPE_LABELS[sub]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block">
              <span className="text-sm text-text-secondary">Business name</span>
              <input
                required
                placeholder="Business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
              />
            </label>

            <label className="block">
              <span className="text-sm text-text-secondary">GSTIN (optional)</span>
              <input
                placeholder="GSTIN"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-text-secondary">Timezone</span>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">Currency</span>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        ) : null}

        {currentStep === 'feature_preview' ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Based on <strong className="text-text-primary">{profile.label}</strong>, you get
              these capabilities. Recommended plan:{' '}
              <strong className="text-brand-primary">{profile.recommendedPlan}</strong>
            </p>
            <ul className="flex flex-wrap gap-2">
              {profile.features.map((f) => (
                <li
                  key={f}
                  className="rounded-lg border border-white/10 bg-bg-primary px-3 py-1.5 text-xs text-text-secondary"
                >
                  {FEATURE_LABELS[f] ?? f}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {currentStep === 'menu_setup' ? (
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              We will seed these sample categories after setup. You can edit them anytime in Menu.
            </p>
            <ul className="list-inside list-disc text-sm text-text-primary">
              {profile.sampleCategories.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {currentStep === 'tables' ? (
          <p className="text-sm text-text-secondary">
            After setup, add tables under Tables and print QR codes for dine-in ordering.
          </p>
        ) : null}

        {currentStep === 'tax_gst' ? (
          <p className="text-sm text-text-secondary">
            GSTIN is saved with your business. Configure tax groups later in Settings if needed.
            {gstin ? ` Current GSTIN: ${gstin}` : ' You can add a GSTIN on the previous step.'}
          </p>
        ) : null}

        {currentStep === 'staff' ? (
          <p className="text-sm text-text-secondary">
            Invite waiters, cashiers, managers, and kitchen staff from the Staff page after setup.
          </p>
        ) : null}

        {currentStep === 'recipes' ? (
          <p className="text-sm text-text-secondary">
            Bakery and production recipes can be managed under Recipes / Production after setup.
          </p>
        ) : null}

        {currentStep === 'done' ? (
          <p className="text-sm text-text-secondary">
            Everything looks good. Complete setup to open your {profile.label} dashboard.
          </p>
        ) : null}

        {saveError ? (
          <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{saveError}</p>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0 || saving}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-sm disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={saving}
            className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-bg-primary disabled:opacity-50"
          >
            {saving ? 'Saving…' : isLast ? 'Complete setup' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
