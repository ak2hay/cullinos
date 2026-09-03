import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BUSINESS_TYPE_DEFAULTS,
  BUSINESS_TYPE_LABELS,
  BUSINESS_TYPE_PARENT_LABELS,
  BUSINESS_TYPE_PARENTS,
  QSR_SUBTYPE_LABELS,
  QSR_SUBTYPES,
  getBusinessTypeParent,
  resolveBusinessTypeFromParent,
  type BusinessType,
  type BusinessTypeParent,
  type OnboardingStep,
  type QsrSubtype,
} from '@cullinos/shared';
import { outletsApi, settingsApi } from '@/lib/api';

const STEP_LABELS: Record<OnboardingStep, string> = {
  business_info: 'Business Info',
  menu_setup: 'Menu Setup',
  tables: 'Tables',
  tax_gst: 'Tax & GST',
  staff: 'Staff',
  recipes: 'Recipes',
  done: 'Done',
};

export function OnboardingWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [parentType, setParentType] = useState<BusinessTypeParent>('restaurant');
  const [qsrSubtype, setQsrSubtype] = useState<QsrSubtype>('cafe');
  const [businessName, setBusinessName] = useState('');
  const [gstin, setGstin] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const businessType: BusinessType = useMemo(
    () => resolveBusinessTypeFromParent(parentType, qsrSubtype),
    [parentType, qsrSubtype],
  );

  const steps = useMemo(
    () => BUSINESS_TYPE_DEFAULTS[businessType].onboardingSteps,
    [businessType],
  );
  const currentStep = steps[stepIndex];

  async function saveBusinessInfo() {
    setSaving(true);
    setSaveError(null);
    try {
      const defaults = BUSINESS_TYPE_DEFAULTS[businessType];
      await settingsApi.update({
        businessType,
        name: businessName,
        gstin,
        operatingMode: defaults.operatingMode,
        enabledOrderTypes: defaults.enabledOrderTypes,
        sampleCategories: defaults.sampleCategories,
      });

      // Sync outlet operatingMode so POS/counter UX matches the type.
      const outlets = await outletsApi.list();
      await Promise.all(
        outlets.map((outlet) =>
          outletsApi.update(outlet.id, { operatingMode: defaults.operatingMode }),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ['organizations', 'current'] });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save business info. Please try again.');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleContinue() {
    if (currentStep === 'business_info') {
      try {
        await saveBusinessInfo();
      } catch {
        return;
      }
    }
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  }

  function handleParentChange(next: BusinessTypeParent) {
    setParentType(next);
    if (next === 'qsr' && getBusinessTypeParent(businessType) !== 'qsr') {
      setQsrSubtype('cafe');
    }
    setStepIndex(0);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Food business setup</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure your outlet for {BUSINESS_TYPE_LABELS[businessType].toLowerCase()}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map((step, i) => (
          <div
            key={step}
            className={`rounded-full border px-3 py-1.5 text-xs sm:text-sm ${
              i === stepIndex
                ? 'border-brand-primary bg-brand-primary/15 font-medium text-brand-primary'
                : 'border-white/10 bg-bg-card text-text-muted'
            }`}
          >
            {STEP_LABELS[step]}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/5 bg-bg-card p-5 sm:p-8">
        <h2 className="text-lg font-semibold">{STEP_LABELS[currentStep]}</h2>

        {currentStep === 'business_info' && (
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-text-secondary">Business category</label>
            <select
              value={parentType}
              onChange={(e) => handleParentChange(e.target.value as BusinessTypeParent)}
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
            >
              {BUSINESS_TYPE_PARENTS.map((parent) => (
                <option key={parent} value={parent}>
                  {BUSINESS_TYPE_PARENT_LABELS[parent]}
                </option>
              ))}
            </select>

            {parentType === 'qsr' ? (
              <>
                <label className="block text-sm text-text-secondary">QSR subcategory</label>
                <select
                  value={qsrSubtype}
                  onChange={(e) => {
                    setQsrSubtype(e.target.value as QsrSubtype);
                    setStepIndex(0);
                  }}
                  className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
                >
                  {QSR_SUBTYPES.map((sub) => (
                    <option key={sub} value={sub}>
                      {QSR_SUBTYPE_LABELS[sub]}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            <input
              placeholder="Business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
            />
            <input
              placeholder="GSTIN"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
            />
            <p className="text-xs text-text-muted">
              Recommended plan: {BUSINESS_TYPE_DEFAULTS[businessType].recommendedPlan}
            </p>
            {saveError && (
              <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">
                {saveError}
              </p>
            )}
          </div>
        )}

        {currentStep === 'menu_setup' && (
          <p className="mt-4 text-sm text-text-secondary">
            Sample categories: {BUSINESS_TYPE_DEFAULTS[businessType].sampleCategories.join(', ')}.
            Add your full menu from the Menu page after setup.
          </p>
        )}

        {currentStep === 'tables' && (
          <p className="mt-4 text-sm text-text-secondary">
            Configure your floor plan and table QR codes from the Tables page.
          </p>
        )}

        {currentStep === 'recipes' && (
          <p className="mt-4 text-sm text-text-secondary">
            Link recipes to menu items for production planning and automatic stock deduction.
          </p>
        )}

        {currentStep === 'tax_gst' && (
          <p className="mt-4 text-sm text-text-secondary">
            CGST/SGST at 2.5% each (5% GST) is applied by default on food items.
          </p>
        )}

        {currentStep === 'staff' && (
          <p className="mt-4 text-sm text-text-secondary">
            Invite team members from the Staff page. Waiter app is optional for counter-service businesses.
          </p>
        )}

        {currentStep === 'done' && (
          <p className="mt-4 text-sm text-brand-primary">
            Your {BUSINESS_TYPE_LABELS[businessType].toLowerCase()} is ready.
            {businessType === 'food_truck' || businessType === 'cafe' || businessType === 'qsr'
              ? ' Open POS in counter mode to start taking orders.'
              : ' Open POS to start taking orders.'}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => setStepIndex(stepIndex - 1)}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-text-secondary hover:bg-white/5"
            >
              Back
            </button>
          )}
          {stepIndex < steps.length - 1 ? (
            <button
              type="button"
              disabled={saving}
              onClick={handleContinue}
              className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-bg-primary disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-bg-primary"
            >
              Go to dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
