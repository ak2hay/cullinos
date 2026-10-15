import { useQuery } from '@tanstack/react-query';
import { inputClass, LabeledInput } from '@/components/common';
import { SUPPORT_PORTAL_URL } from '@/lib/api';
import { supportApi } from '@/lib/platform-api';

/** Required support ticket for a billing override; lists only this tenant's tickets. */
export function TenantTicketPicker({
  organizationId,
  value,
  onChange,
}: {
  organizationId: string | null;
  value: string;
  onChange: (ticketId: string) => void;
}) {
  const tickets = useQuery({
    queryKey: ['super-admin', 'tickets', 'tenant', organizationId],
    queryFn: () => supportApi.tickets({ organizationId: organizationId! }),
    enabled: Boolean(organizationId),
  });
  const rows = tickets.data?.data ?? [];
  return (
    <LabeledInput
      label="Support ticket"
      hint={
        tickets.isSuccess && rows.length === 0
          ? 'No tickets for this tenant yet. Raise one in the support portal first.'
          : 'Required. The change is noted on the ticket and in the tenant audit log.'
      }
    >
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={tickets.isLoading}>
        <option value="">{tickets.isLoading ? 'Loading tickets…' : 'Select a ticket'}</option>
        {rows.map((t) => (
          <option key={t.id} value={t.id}>
            {t.ref} · {t.subject} ({t.status.replace('_', ' ')})
          </option>
        ))}
      </select>
      {tickets.isSuccess && rows.length === 0 ? (
        <a
          href={`${SUPPORT_PORTAL_URL}/agent/tickets/new`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-accent hover:underline"
        >
          Raise a ticket
        </a>
      ) : null}
    </LabeledInput>
  );
}
