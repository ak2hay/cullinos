import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  BUSINESS_TYPE_PARENT_LABELS,
  BUSINESS_TYPE_PARENTS,
  QSR_SUBTYPE_LABELS,
  QSR_SUBTYPES,
  RESTAURANT_SIZE_LABELS,
  RESTAURANT_SIZES,
  resolveBusinessTypeFromParent,
  type BusinessTypeParent,
  type QsrSubtype,
  type RestaurantSize,
} from '@cullinos/shared';
import { inputClass, LabeledInput } from '@/components/common';
import { FormDrawer } from '@/components/ui';
import { superAdminApi, type PlanSummary } from '@/lib/api';
import { formatInr } from '@/lib/format';

export type OnboardCredentials = {
  ownerEmail: string;
  temporaryPassword: string;
  adminUrl: string;
  emailSent: boolean;
};

const FALLBACK_PLANS = ['starter', 'professional', 'enterprise'];

export function OnboardTenantDrawer({
  open,
  onClose,
  plans,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  plans: PlanSummary[];
  onCreated: (credentials: OnboardCredentials) => void;
}) {
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState('');
  const [outletName, setOutletName] = useState('Main Outlet');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [planSlug, setPlanSlug] = useState('professional');
  const [parentType, setParentType] = useState<BusinessTypeParent>('restaurant');
  const [qsrSubtype, setQsrSubtype] = useState<QsrSubtype>('cafe');
  const [restaurantSize, setRestaurantSize] = useState<RestaurantSize>('medium');

  const businessType = useMemo(() => resolveBusinessTypeFromParent(parentType, qsrSubtype), [parentType, qsrSubtype]);

  function reset() {
    setCompanyName('');
    setOutletName('Main Outlet');
    setOwnerEmail('');
    setOwnerName('');
    setParentType('restaurant');
    setQsrSubtype('cafe');
    setRestaurantSize('medium');
  }

  const onboard = useMutation({
    mutationFn: superAdminApi.onboardRestaurant,
    onSuccess: (result) => {
      onCreated({
        ownerEmail: result.ownerEmail,
        temporaryPassword: result.temporaryPassword,
        adminUrl: result.adminUrl,
        emailSent: result.emailSent,
      });
      reset();
      onboard.reset();
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
  });

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Onboard restaurant"
      description="Creates the tenant, its first outlet, a subscription and a one-time owner password (shown once and emailed)."
      submitLabel="Create tenant"
      loading={onboard.isPending}
      error={onboard.error}
      onSubmit={() =>
        onboard.mutate({
          companyName,
          outletName,
          ownerName: ownerName || undefined,
          ownerEmail,
          planSlug,
          businessType,
          restaurantSize: parentType === 'restaurant' ? restaurantSize : null,
        })
      }
    >
      <fieldset className="space-y-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Business</legend>
        <LabeledInput label="Restaurant name">
          <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} />
        </LabeledInput>
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledInput label="Business category">
            <select
              value={parentType}
              onChange={(e) => {
                const next = e.target.value as BusinessTypeParent;
                setParentType(next);
                if (next === 'qsr') setQsrSubtype('cafe');
              }}
              className={inputClass}
            >
              {BUSINESS_TYPE_PARENTS.map((p) => (
                <option key={p} value={p}>
                  {BUSINESS_TYPE_PARENT_LABELS[p]}
                </option>
              ))}
            </select>
          </LabeledInput>
          {parentType === 'restaurant' ? (
            <LabeledInput label="Restaurant size">
              <select value={restaurantSize} onChange={(e) => setRestaurantSize(e.target.value as RestaurantSize)} className={inputClass}>
                {RESTAURANT_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {RESTAURANT_SIZE_LABELS[s]}
                  </option>
                ))}
              </select>
            </LabeledInput>
          ) : null}
          {parentType === 'qsr' ? (
            <LabeledInput label="QSR subcategory">
              <select value={qsrSubtype} onChange={(e) => setQsrSubtype(e.target.value as QsrSubtype)} className={inputClass}>
                {QSR_SUBTYPES.map((s) => (
                  <option key={s} value={s}>
                    {QSR_SUBTYPE_LABELS[s]}
                  </option>
                ))}
              </select>
            </LabeledInput>
          ) : null}
        </div>
        <LabeledInput label="First outlet name">
          <input required value={outletName} onChange={(e) => setOutletName(e.target.value)} className={inputClass} />
        </LabeledInput>
      </fieldset>

      <fieldset className="space-y-2 border-t border-line-subtle pt-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Plan</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(plans.length ? plans.map((p) => ({ slug: p.slug, name: p.name, price: p.priceMonthly })) : FALLBACK_PLANS.map((s) => ({ slug: s, name: s, price: null }))).map(
            (p) => (
              <label
                key={p.slug}
                className={`cursor-pointer rounded-xl border p-3 text-sm transition ${
                  planSlug === p.slug ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-line hover:border-line-strong'
                }`}
              >
                <input type="radio" name="plan" value={p.slug} checked={planSlug === p.slug} onChange={() => setPlanSlug(p.slug)} className="sr-only" />
                <span className="block font-medium capitalize">{p.name}</span>
                <span className="block text-xs text-text-muted">{p.price != null ? `${formatInr(Number(p.price))} / month` : p.slug}</span>
              </label>
            ),
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-line-subtle pt-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Owner</legend>
        <LabeledInput label="Owner name">
          <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputClass} />
        </LabeledInput>
        <LabeledInput
          label="Owner email (Admin login)"
          hint="Must be unique. Do not use your platform admin email. A one-time password is generated automatically."
        >
          <input type="email" required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className={inputClass} />
        </LabeledInput>
      </fieldset>
    </FormDrawer>
  );
}
