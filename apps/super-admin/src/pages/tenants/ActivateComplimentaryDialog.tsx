import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { inputClass, LabeledInput } from '@/components/common';
import { TenantTicketPicker } from '@/components/TenantTicketPicker';
import { ConfirmDialog } from '@/components/ui';
import { ApprovalPendingError, superAdminApi } from '@/lib/api';
import { formatInr } from '@/lib/format';
import { dateInputPlusDays, dateInputToTrialIso } from '@/lib/trial';

const QUICK_PERIODS = [
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '1 year', days: 365 },
] as const;
const MAX_COMPLIMENTARY_DAYS = 3 * 366;

export function ActivateComplimentaryDialog({
  tenant,
  onClose,
}: {
  tenant: { id: string; name: string; plan?: string | null } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: plans = [] } = useQuery({
    queryKey: ['super-admin', 'plans'],
    queryFn: () => superAdminApi.listPlans(),
    enabled: Boolean(tenant),
  });
  const [planId, setPlanId] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [reason, setReason] = useState('');

  const tenantId = tenant?.id ?? null;
  const tenantPlan = tenant?.plan ?? null;
  useEffect(() => {
    if (!tenantId) return;
    setPeriodEnd(dateInputPlusDays(30));
    setTicketId('');
    setReason('');
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || planId || plans.length === 0) return;
    const current = plans.find((p) => p.slug === tenantPlan && p.isActive !== false);
    setPlanId(current?.id ?? plans.find((p) => p.isActive !== false)?.id ?? '');
  }, [tenantId, tenantPlan, plans, planId]);

  const save = useMutation({
    mutationFn: () =>
      superAdminApi.activateComplimentarySubscription(tenant!.id, {
        planId,
        periodEnd: dateInputToTrialIso(periodEnd),
        ticketId,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organization', tenant!.id] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'analytics'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApprovalPendingError) onClose();
    },
  });

  const { reset } = save;
  useEffect(() => {
    if (!tenantId) {
      reset();
      setPlanId('');
    }
  }, [tenantId, reset]);

  const reasonOk = reason.trim().length >= 10;

  return (
    <ConfirmDialog
      open={Boolean(tenant)}
      onClose={onClose}
      onConfirm={() => save.mutate()}
      title="Activate without payment"
      description={
        tenant
          ? `${tenant.name} gets an active subscription with no charge until the date below. It needs a support ticket and may need approval.`
          : undefined
      }
      confirmLabel="Activate"
      loading={save.isPending}
      error={save.error instanceof ApprovalPendingError ? null : save.error}
      confirmDisabled={!planId || !periodEnd || !ticketId || !reasonOk}
    >
      <LabeledInput label="Plan">
        <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
          {plans
            .filter((p) => p.isActive !== false)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatInr(p.priceMonthly)}){p.visibility === 'private' ? ' (private)' : ''}
              </option>
            ))}
        </select>
      </LabeledInput>
      <div className="flex flex-wrap gap-2">
        {QUICK_PERIODS.map((q) => (
          <button
            key={q.days}
            type="button"
            onClick={() => setPeriodEnd(dateInputPlusDays(q.days))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-hover"
          >
            {q.label}
          </button>
        ))}
      </div>
      <LabeledInput label="Active until" hint="Access ends after this day unless the tenant pays or it is extended.">
        <input
          type="date"
          value={periodEnd}
          min={dateInputPlusDays(1)}
          max={dateInputPlusDays(MAX_COMPLIMENTARY_DAYS)}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className={inputClass}
        />
      </LabeledInput>
      <TenantTicketPicker organizationId={tenantId} value={ticketId} onChange={setTicketId} />
      <LabeledInput label="Reason" hint="At least 10 characters. Stored in the audit log and on the ticket.">
        <input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="e.g. Pilot partner, 3 months free agreed by sales" />
      </LabeledInput>
    </ConfirmDialog>
  );
}
