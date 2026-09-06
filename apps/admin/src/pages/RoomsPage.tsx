import { useQuery } from '@tanstack/react-query';
import { DataTable, ErrorBanner, PageHeader } from '@cullinos/ui';
import { hospitalityApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export function RoomsPage() {
  const outletId = useAuthStore((s) => s.selectedOutletId);

  const roomsQuery = useQuery({
    queryKey: ['hospitality', 'rooms', outletId],
    queryFn: () => hospitalityApi.listRooms(outletId ?? undefined),
  });

  const rooms = roomsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms"
        description="Room inventory, types, and occupancy status for the selected outlet."
      />

      {roomsQuery.error ? (
        <ErrorBanner>
          {roomsQuery.error instanceof Error
            ? roomsQuery.error.message
            : 'Failed to load rooms'}
        </ErrorBanner>
      ) : null}

      <DataTable
        columns={[
          {
            key: 'number',
            header: 'Number',
            cell: (room) => <span className="font-medium">{room.number}</span>,
          },
          {
            key: 'type',
            header: 'Type',
            cell: (room) => (
              <span className="text-text-secondary">{room.roomType?.name ?? '—'}</span>
            ),
          },
          {
            key: 'floor',
            header: 'Floor',
            cell: (room) => (
              <span className="text-text-secondary">{room.floor ?? '—'}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            cell: (room) => (
              <span className="font-mono text-xs uppercase text-text-secondary">
                {room.status}
              </span>
            ),
          },
        ]}
        rows={rooms}
        getRowKey={(room) => room.id}
        loading={roomsQuery.isLoading}
        emptyMessage="No rooms configured yet."
      />
    </div>
  );
}
