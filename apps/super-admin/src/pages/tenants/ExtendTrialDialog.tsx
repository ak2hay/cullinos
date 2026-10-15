import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { inputClass, LabeledInput } from '@/components/common';
import { TenantTicketPicker } from '@/components/TenantTicketPicker';
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
  const [ticketId, setTicketId] = useState('');
  const [note, setNote] = useState('');

  const currentEnd = tenant?.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
  // Quick extensions add to the current end while the trial is still running, else to today.
  const base = currentEnd && currentEnd.getTime() > Date.now() ? currentEnd : new Date();

  const tenantId = tenant?.id ?? null;
  const tenantTrialEnd = tenant?.trialEndsAt ?? null;
  useEffect(() => {
    if (!tenantId) return;
    const current = isoToDateInput(tenantTrialEnd);
    setValue(current && current > dateInputPlusDays(0) ? current : dateInputPlusDays(30));
    setTicketId('');
    setNote('');
  }, [tenantId, tenantTrialEnd]);

  const save = useMutation({
    mutationFn: () =>
      superAdminApi.setTrialEnd(tenant!.id, {
        trialEndsAt: dateInputToTrialIso(value),
        ticketId,
        note: note.trim() || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organization', tenant!.id] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'analytics'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] });
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
      confirmDisabled={!value || !ticketId}
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
      <TenantTicketPicker organizationId={tenantId} value={ticketId} onChange={setTicketId} />
      <LabeledInput label="Note (optional)">
        <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Why the extension was agreed" />
      </LabeledInput>
    </ConfirmDialog>
  );
}
