import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BUSINESS_TYPE_DEFAULTS, BUSINESS_TYPE_LABELS, BUSINESS_TYPES, } from '@cullinos/shared';
import { settingsApi } from '@/lib/api';
const STEP_LABELS = {
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
    const [businessType, setBusinessType] = useState('restaurant');
    const [businessName, setBusinessName] = useState('');
    const [gstin, setGstin] = useState('');
    const [stepIndex, setStepIndex] = useState(0);
    const [saving, setSaving] = useState(false);
    const steps = useMemo(() => BUSINESS_TYPE_DEFAULTS[businessType].onboardingSteps, [businessType]);
    const currentStep = steps[stepIndex];
    async function saveBusinessInfo() {
        setSaving(true);
        try {
            await settingsApi.update({
                businessType,
                name: businessName,
                gstin,
                operatingMode: BUSINESS_TYPE_DEFAULTS[businessType].operatingMode,
                enabledOrderTypes: BUSINESS_TYPE_DEFAULTS[businessType].enabledOrderTypes,
                sampleCategories: BUSINESS_TYPE_DEFAULTS[businessType].sampleCategories,
            });
        }
        finally {
            setSaving(false);
        }
    }
    async function handleContinue() {
        if (currentStep === 'business_info') {
            await saveBusinessInfo();
        }
        if (stepIndex < steps.length - 1) {
            setStepIndex(stepIndex + 1);
        }
    }
    return (_jsxs("div", { className: "mx-auto max-w-2xl space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Food business setup" }), _jsxs("p", { className: "mt-1 text-sm text-text-secondary", children: ["Configure your outlet for ", BUSINESS_TYPE_LABELS[businessType].toLowerCase(), "."] })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: steps.map((step, i) => (_jsx("div", { className: `rounded-full border px-3 py-1.5 text-xs sm:text-sm ${i === stepIndex
                        ? 'border-brand-primary bg-brand-primary/15 font-medium text-brand-primary'
                        : 'border-white/10 bg-bg-card text-text-muted'}`, children: STEP_LABELS[step] }, step))) }), _jsxs("div", { className: "rounded-xl border border-white/5 bg-bg-card p-5 sm:p-8", children: [_jsx("h2", { className: "text-lg font-semibold", children: STEP_LABELS[currentStep] }), currentStep === 'business_info' && (_jsxs("div", { className: "mt-4 space-y-3", children: [_jsx("label", { className: "block text-sm text-text-secondary", children: "Business type" }), _jsx("select", { value: businessType, onChange: (e) => {
                                    setBusinessType(e.target.value);
                                    setStepIndex(0);
                                }, className: "w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary", children: BUSINESS_TYPES.map((type) => (_jsx("option", { value: type, children: BUSINESS_TYPE_LABELS[type] }, type))) }), _jsx("input", { placeholder: "Business name", value: businessName, onChange: (e) => setBusinessName(e.target.value), className: "w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary" }), _jsx("input", { placeholder: "GSTIN", value: gstin, onChange: (e) => setGstin(e.target.value), className: "w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary" }), _jsxs("p", { className: "text-xs text-text-muted", children: ["Recommended plan: ", BUSINESS_TYPE_DEFAULTS[businessType].recommendedPlan] })] })), currentStep === 'menu_setup' && (_jsxs("p", { className: "mt-4 text-sm text-text-secondary", children: ["Sample categories: ", BUSINESS_TYPE_DEFAULTS[businessType].sampleCategories.join(', '), ". Add your full menu from the Menu page after setup."] })), currentStep === 'tables' && (_jsx("p", { className: "mt-4 text-sm text-text-secondary", children: "Configure your floor plan and table QR codes from the Tables page." })), currentStep === 'recipes' && (_jsx("p", { className: "mt-4 text-sm text-text-secondary", children: "Link recipes to menu items for production planning and automatic stock deduction." })), currentStep === 'tax_gst' && (_jsx("p", { className: "mt-4 text-sm text-text-secondary", children: "CGST/SGST at 2.5% each (5% GST) is applied by default on food items." })), currentStep === 'staff' && (_jsx("p", { className: "mt-4 text-sm text-text-secondary", children: "Invite team members from Settings. Waiter app is optional for counter-service businesses." })), currentStep === 'done' && (_jsxs("p", { className: "mt-4 text-sm text-brand-primary", children: ["Your ", BUSINESS_TYPE_LABELS[businessType].toLowerCase(), " is ready.", businessType === 'food_truck' || businessType === 'cafe' || businessType === 'qsr'
                                ? ' Open POS in counter mode to start taking orders.'
                                : ' Open POS to start taking orders.'] })), _jsxs("div", { className: "mt-6 flex flex-wrap gap-3", children: [stepIndex > 0 && (_jsx("button", { type: "button", onClick: () => setStepIndex(stepIndex - 1), className: "rounded-lg border border-white/10 px-4 py-2.5 text-sm text-text-secondary hover:bg-white/5", children: "Back" })), stepIndex < steps.length - 1 ? (_jsx("button", { type: "button", disabled: saving, onClick: handleContinue, className: "rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-bg-primary disabled:opacity-50", children: saving ? 'Saving…' : 'Continue' })) : (_jsx("button", { type: "button", onClick: () => navigate('/'), className: "rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-bg-primary", children: "Go to dashboard" }))] })] })] }));
}
