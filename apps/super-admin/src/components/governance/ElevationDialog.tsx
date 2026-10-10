import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Dialog } from '@cullinos/ui';
import { inputClass, LabeledInput, MutationError, Notice } from '@/components/common';
import { securityApi } from '@/lib/platform-api';

const DURATIONS = [30, 60, 120, 240, 480];

/** Just-in-time elevation: a time-boxed extra role, approved per the iam.elevate policy. */
export function ElevationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [roleId, setRoleId] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [justification, setJustification] = useState('');
  const [ticketId, setTicketId] = useState('');
  const roles = useQuery({ queryKey: ['super-admin', 'elevation-roles'], queryFn: securityApi.elevationRoles, enabled: open });
  const request = useMutation({
    mutationFn: () =>
      securityApi.requestElevation({
        roleId,
        durationMinutes: minutes,
        justification: justification.trim(),
        ticketId: ticketId.trim() || undefined,
      }),
  });
  const selected = roles.data?.find((r) => r.id === roleId);

  function close() {
    request.reset();
    setJustification('');
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Request temporary access"
      description="Extra permissions for a limited time. Approvers are notified; access ends automatically."
      footer={
        request.data ? (
          <Button size="sm" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={request.isPending}
              disabled={!roleId || justification.trim().length < 15}
              onClick={() => request.mutate()}
            >
              Request
            </Button>
          </>
        )
      }
    >
      {request.data ? (
        <Notice tone={request.data.status === 'active' ? 'success' : 'info'}>
          {request.data.status === 'active'
            ? 'Access granted. The menu updates within a minute.'
            : `Sent for approval as ${request.data.approvalRequest?.ref}. You'll be notified when it is decided.`}
        </Notice>
      ) : (
        <div className="space-y-3">
          <LabeledInput label="Role">
            <select className={inputClass} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">Select a role…</option>
              {roles.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </LabeledInput>
          {selected ? (
            <p className="text-xs text-text-muted">
              {selected.description ? `${selected.description} · ` : ''}
              {selected.permissions.length} permissions
            </p>
          ) : null}
          <LabeledInput label="Duration">
            <select className={inputClass} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`}
                </option>
              ))}
            </select>
          </LabeledInput>
          <LabeledInput label="Justification" hint="At least 15 characters. Visible to approvers and in the activity log.">
            <textarea className={`${inputClass} min-h-24`} value={justification} onChange={(e) => setJustification(e.target.value)} />
          </LabeledInput>
          <LabeledInput label="Related ticket ID (optional)">
            <input className={inputClass} value={ticketId} onChange={(e) => setTicketId(e.target.value)} />
          </LabeledInput>
          <MutationError error={request.error} />
        </div>
      )}
    </Dialog>
  );
}
