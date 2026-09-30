import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneField } from '@cullinos/ui';
import {
  BUSINESS_TYPE_PARENT_LABELS,
  BUSINESS_TYPE_PARENTS,
  FEATURE_LABELS,
  QSR_SUBTYPE_LABELS,
  QSR_SUBTYPES,
  RESTAURANT_SIZE_LABELS,
  RESTAURANT_SIZES,
  getBusinessTypeParent,
  getBusinessTypeRules,
  getFeaturesForProfile,
  resolveBusinessTypeFromParent,
  type BusinessType,
  type BusinessTypeParent,
  type OnboardingStep,
  type QsrSubtype,
  type RestaurantSize,
} from '@cullinos/shared';
import { CatalogPickerDrawer } from '@/features/menu/CatalogPickerDrawer';
import { organizationsApi, outletsApi, settingsApi } from '@/lib/api';
import { isValidMobile } from '@/lib/format';

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
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
  const [currency, setCurrency] = useState<string>('INR');
  const [servesAlcohol, setServesAlcohol] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const orgQuery = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
  });
  const prefilled = useRef(false);
  useEffect(() => {
    const org = orgQuery.data;
    if (!org || prefilled.current) return;
    prefilled.current = true;
    setBusinessName((prev) => prev || org.name || '');
    setPhone((prev) => prev || org.phone || '');
    setGstin((prev) => prev || org.gstin || '');
  }, [orgQuery.data]);

  const businessType: BusinessType = useMemo(
    () => resolveBusinessTypeFromParent(parentType, qsrSubtype),
    [parentType, qsrSubtype],
  );

  const businessRules = getBusinessTypeRules(businessType);
  const alcoholEnabled = businessRules.alcoholAlwaysOn || (businessRules.alcoholToggle && servesAlcohol);

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

  async function goNext() {
    if (currentStep === 'business_info' && !businessName.trim()) {
      setSaveError('Business name is required.');
      return;
    }
    if (currentStep === 'business_info' && !isValidMobile(phone)) {
      setSaveError('A valid business mobile number is required.');
      return;
    }
    setSaveError(null);
    if (isLast) {
      void handleComplete();
      return;
    }
    if (currentStep === 'business_info') {
      // The menu catalog step filters by the saved business type and alcohol setting.
      setSaving(true);
      try {
        await settingsApi.update({
          businessType,
          restaurantSize: parentType === 'restaurant' ? restaurantSize : null,
          name: businessName.trim(),
          phone,
          servesAlcohol: alcoholEnabled,
        });
        await queryClient.invalidateQueries({ queryKey: ['menu', 'catalog'] });
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save business details.');
        return;
      } finally {
        setSaving(false);
      }
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
        phone,
        gstin: gstin.trim() || undefined,
        timezone,
        currency,
        operatingMode: profile.operatingMode,
        enabledOrderTypes: profile.enabledOrderTypes,
        sampleCategories: profile.sampleCategories,
        servesAlcohol: alcoholEnabled,
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
              className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-brand-primary' : 'bg-hover-strong'}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-line-subtle bg-bg-card p-5 sm:p-8">
        {currentStep === 'business_info' ? (
          <>
            <label className="block">
              <span className="text-sm text-text-secondary">Business category</span>
              <select
                value={parentType}
                onChange={(e) => handleParentChange(e.target.value as BusinessTypeParent)}
                className="mt-1 w-full rounded-lg border border-line bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
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
                  className="mt-1 w-full rounded-lg border border-line bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
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
                  className="mt-1 w-full rounded-lg border border-line bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
                >
                  {QSR_SUBTYPES.map((sub) => (
                    <option key={sub} value={sub}>
                      {QSR_SUBTYPE_LABELS[sub]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {businessRules.alcoholToggle ? (
              <label className="flex items-start gap-3 rounded-lg border border-line bg-bg-primary px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={servesAlcohol}
                  onChange={(e) => setServesAlcohol(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium">Serves alcohol</span>
                  <span className="block text-xs text-text-secondary">
                    Adds whisky, beer, wine and cocktail brands to your menu catalog.
                  </span>
                </span>
              </label>
            ) : null}

            <label className="block">
              <span className="text-sm text-text-secondary">Business name</span>
              <input
                required
                placeholder="Business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
              />
            </label>

            <PhoneField
              label="Business mobile number"
              required
              value={phone}
              onChange={setPhone}
            />

            <label className="block">
              <span className="text-sm text-text-secondary">GSTIN (optional)</span>
              <input
                placeholder="GSTIN"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-text-secondary">Timezone</span>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
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
                  className="mt-1 w-full rounded-lg border border-line bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
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
                  className="rounded-lg border border-line bg-bg-primary px-3 py-1.5 text-xs text-text-secondary"
                >
                  {FEATURE_LABELS[f] ?? f}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {currentStep === 'menu_setup' ? (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border border-brand-primary/30 bg-brand-primary/5 p-4">
              <p className="text-sm font-medium text-text-primary">Start from our menu catalog</p>
              <p className="text-sm text-text-secondary">
                Pick ready-made {profile.label.toLowerCase()} dishes
                {alcoholEnabled ? ' and liquor brands' : ''} with suggested prices. Change names and
                prices now, upload photos later.
              </p>
              <button
                type="button"
                onClick={() => setCatalogOpen(true)}
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-on-brand"
              >
                Pick from catalog
              </button>
              {importedCount > 0 ? (
                <p className="text-xs text-text-secondary">
                  {importedCount} item(s) added to your menu so far.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">
                We will also seed these sample categories after setup. You can edit them anytime in Menu.
              </p>
              <ul className="list-inside list-disc text-sm text-text-primary">
                {profile.sampleCategories.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <CatalogPickerDrawer
              open={catalogOpen}
              onClose={() => setCatalogOpen(false)}
              onImported={(result) => setImportedCount((n) => n + result.created.length)}
            />
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
            {businessType === 'bar'
              ? ' For liquor, use "Seed India presets" in Settings → Tax to add the "State Excise (alcohol)" group, set your state rate, and assign it to liquor items instead of a GST group.'
              : null}
          </p>
        ) : null}

        {currentStep === 'staff' ? (
          <p className="text-sm text-text-secondary">
            Invite waiters, cashiers, managers, and kitchen staff from the Staff page after setup.
          </p>
        ) : null}

        {currentStep === 'recipes' ? (
          <p className="text-sm text-text-secondary">
            {businessType === 'bar'
              ? 'Brands added from the catalog already deduct 30 ml per peg (60 ml pegs and bottles use the variant stock ×) from bottle stock. Set opening stock in Inventory, and adjust pour sizes under Recipes if yours differ.'
              : 'Bakery and production recipes can be managed under Recipes / Production after setup.'}
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
            className="rounded-lg border border-line px-4 py-2.5 text-sm disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={saving}
            className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-50"
          >
            {saving ? 'Saving…' : isLast ? 'Complete setup' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
