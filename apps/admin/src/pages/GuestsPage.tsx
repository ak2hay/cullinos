import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, DataTable, ErrorBanner, PageHeader, useToast } from '@cullinos/ui';
import { hospitalityApi } from '@/lib/api';

export function GuestsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const guestsQuery = useQuery({
    queryKey: ['hospitality', 'guests'],
    queryFn: hospitalityApi.listGuests,
  });

  const eraseMutation = useMutation({
    mutationFn: (id: string) => hospitalityApi.eraseGuest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitality', 'guests'] });
      toast.success('Guest personal data anonymized.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const guests = guestsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guests"
        description="Hotel guest profiles for room posting and banquet bookings. ID numbers are masked in lists and encrypted at rest when configured."
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
          {
            key: 'actions',
            header: 'Actions',
            cell: (guest) => (
              <Button
                type="button"
                variant="secondary"
                className="h-9 px-3 text-xs"
                loading={eraseMutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      'Anonymize this guest’s personal data including ID documents?',
                    )
                  ) {
                    eraseMutation.mutate(guest.id);
                  }
                }}
              >
                Erase
              </Button>
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
