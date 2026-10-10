import { useQuery } from '@tanstack/react-query';
import { PageShell } from '@cullinos/ui';
import { auditApi, type AuditEntry } from '@/lib/api';
import { formatDate, formatMoneyExact } from '@/lib/format';

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  'order.refunded': { label: 'Refunded', className: 'text-status-error' },
  'order.refund_pin_failed': { label: 'Wrong passcode', className: 'text-status-warning' },
  'user.refund_pin_set': { label: 'Passcode set', className: 'text-text-secondary' },
};

function detailFor(entry: AuditEntry): string {
  const meta = entry.metadata ?? {};
  if (entry.action === 'order.refunded') {
    const parts: string[] = [];
    if (typeof meta.orderNumber === 'string') parts.push(`Order #${meta.orderNumber}`);
    if (typeof meta.amount === 'number') parts.push(formatMoneyExact(Math.round(meta.amount * 100)));
    if (typeof meta.reason === 'string' && meta.reason) parts.push(meta.reason);
    if (meta.externalRefundConfirmed === true) parts.push('confirmed as refunded outside Cullinos');
    return parts.join(' · ');
  }
  if (entry.action === 'order.refund_pin_failed') {
    return meta.locked === true
      ? 'Refunds locked for 15 min'
      : typeof meta.remaining === 'number'
        ? `${meta.remaining} attempts left`
        : '';
  }
  if (entry.action === 'user.refund_pin_set') {
    return meta.changed === true ? 'Changed passcode' : 'First passcode';
  }
  return '';
}

export function ActivityLogPage() {
  const logQuery = useQuery({
    queryKey: ['audit', 'refunds', 'all'],
    queryFn: () => auditApi.refunds(),
    refetchInterval: 30_000,
  });
  const entries = logQuery.data ?? [];

  return (
    <PageShell
      title="Activity log"
      description="Every refund, wrong passcode and passcode change, with who did it. Shows the latest 200 events."
    >
      <div className="overflow-hidden rounded-xl border border-line-subtle bg-bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line-subtle bg-bg-elevated text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Who</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {logQuery.isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : logQuery.error ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-status-error">
                  {logQuery.error instanceof Error ? logQuery.error.message : 'Could not load activity'}
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  No refund activity yet.
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const action = ACTION_LABELS[entry.action];
                return (
                  <tr key={entry.id} className="border-b border-line-subtle last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {entry.user?.name ?? entry.user?.email ?? 'Unknown user'}
                      {entry.metadata?.impersonatedBy ? (
                        <span className="ml-1 text-xs text-text-muted">(support session)</span>
                      ) : null}
                    </td>
                    <td className={`px-4 py-3 font-medium ${action?.className ?? ''}`}>
                      {action?.label ?? entry.action}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{detailFor(entry)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
