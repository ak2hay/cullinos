import { useQuery } from '@tanstack/react-query';
import { DataTable, ErrorBanner, PageHeader } from '@cullinos/ui';
import { hospitalityApi } from '@/lib/api';

export function GuestsPage() {
  const guestsQuery = useQuery({
    queryKey: ['hospitality', 'guests'],
    queryFn: hospitalityApi.listGuests,
  });

  const guests = guestsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guests"
        description="Hotel guest profiles for room posting and banquet bookings."
      />

      {guestsQuery.error ? (
        <ErrorBanner>
          {guestsQuery.error instanceof Error
            ? guestsQuery.error.message
            : 'Failed to load guests'}
        </ErrorBanner>
      ) : null}

      <DataTable
        columns={[
          {
            key: 'name',
            header: 'Name',
            cell: (guest) => <span className="font-medium">{guest.name}</span>,
          },
          {
            key: 'phone',
            header: 'Phone',
            cell: (guest) => (
              <span className="text-text-secondary">{guest.phone ?? '—'}</span>
            ),
          },
          {
            key: 'email',
            header: 'Email',
            cell: (guest) => (
              <span className="text-text-secondary">{guest.email ?? '—'}</span>
            ),
          },
          {
            key: 'document',
            header: 'Document',
            cell: (guest) => (
              <span className="font-mono text-xs text-text-secondary">
                {guest.documentType || guest.documentNumber
                  ? `${guest.documentType ?? ''} ${guest.documentNumber ?? ''}`.trim()
                  : '—'}
              </span>
            ),
          },
        ]}
        rows={guests}
        getRowKey={(guest) => guest.id}
        loading={guestsQuery.isLoading}
        emptyMessage="No guests yet."
      />
    </div>
  );
}
