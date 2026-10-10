import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { inputClass, LabeledInput } from '@/components/common';
import { ConfirmDialog } from '@/components/ui';
import { superAdminApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { MAX_TRIAL_DAYS, dateInputPlusDays, dateInputToTrialIso, isoToDateInput } from '@/lib/trial';

const QUICK_DAYS = [7, 15, 30] as const;

export function ExtendTrialDialog({
  tenant,
  onClose,
  onDone,
}: {
  tenant: { id: string; name: string; trialEndsAt: string | null } | null;
  onClose: () => void;
  onDone?: (trialEndsAt: string) => void;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState('');

  const currentEnd = tenant?.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
  // Quick extensions add to the current end while the trial is still running, else to today.
  const base = currentEnd && currentEnd.getTime() > Date.now() ? currentEnd : new Date();

  const tenantId = tenant?.id ?? null;
  const tenantTrialEnd = tenant?.trialEndsAt ?? null;
  useEffect(() => {
    if (!tenantId) return;
    const current = isoToDateInput(tenantTrialEnd);
    setValue(current && current > dateInputPlusDays(0) ? current : dateInputPlusDays(30));
  }, [tenantId, tenantTrialEnd]);

  const save = useMutation({
    mutationFn: () => superAdminApi.setTrialEnd(tenant!.id, dateInputToTrialIso(value)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organization', tenant!.id] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'analytics'] });
      onDone?.(res.trialEndsAt);
      onClose();
    },
  });

  const { reset } = save;
  useEffect(() => {
    if (!tenantId) reset();
  }, [tenantId, reset]);

  return (
    <ConfirmDialog
      open={Boolean(tenant)}
      onClose={onClose}
      onConfirm={() => save.mutate()}
      title="Set trial end date"
      description={
        tenant
          ? `${tenant.name} · ${currentEnd ? `current trial ends ${formatDate(currentEnd)}` : 'no trial date set'}`
          : undefined
      }
      confirmLabel="Save trial date"
      loading={save.isPending}
      error={save.error}
      confirmDisabled={!value}
    >
      <div className="flex flex-wrap gap-2">
        {QUICK_DAYS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setValue(dateInputPlusDays(d, base))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-hover"
          >
            +{d} days
          </button>
        ))}
      </div>
      <LabeledInput label="Trial ends on" hint="The tenant keeps full access through the end of this day. Expired or suspended trials are reopened.">
        <input
          type="date"
          value={value}
          min={dateInputPlusDays(1)}
          max={dateInputPlusDays(MAX_TRIAL_DAYS)}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
        />
      </LabeledInput>
    </ConfirmDialog>
  );
}
