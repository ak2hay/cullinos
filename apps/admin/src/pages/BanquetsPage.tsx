import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input, PageHeader, useToast } from '@cullinos/ui';
import { banquetsApi } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';

export function BanquetsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pkg, setPkg] = useState({ name: '', capacity: '50', baseRate: '' });
  const [booking, setBooking] = useState({
    banquetId: '',
    guestName: '',
    guestPhone: '',
    eventDate: '',
    guestCount: '20',
  });

  const packagesQuery = useQuery({ queryKey: ['banquets'], queryFn: banquetsApi.list });
  const bookingsQuery = useQuery({
    queryKey: ['banquets', 'bookings'],
    queryFn: banquetsApi.listBookings,
  });

  function showNotice(type: 'success' | 'error', text: string) {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  }

  const createPackageMutation = useMutation({
    mutationFn: () =>
      banquetsApi.create({
        name: pkg.name.trim(),
        capacity: pkg.capacity ? Number(pkg.capacity) : undefined,
        baseRate: pkg.baseRate ? Number(pkg.baseRate) : undefined,
      }),
    onSuccess: () => {
      setPkg({ name: '', capacity: '50', baseRate: '' });
      queryClient.invalidateQueries({ queryKey: ['banquets'] });
      showNotice('success', 'Banquet package created.');
    },
    onError: (err: Error) => showNotice('error', err.message),
  });

  const createBookingMutation = useMutation({
    mutationFn: () =>
      banquetsApi.createBooking({
        banquetId: booking.banquetId,
        guestName: booking.guestName.trim(),
        guestPhone: booking.guestPhone.trim() || undefined,
        eventDate: new Date(booking.eventDate).toISOString(),
        guestCount: booking.guestCount ? Number(booking.guestCount) : undefined,
      }),
    onSuccess: () => {
      setBooking((b) => ({
        ...b,
        guestName: '',
        guestPhone: '',
        eventDate: '',
        guestCount: '20',
      }));
      queryClient.invalidateQueries({ queryKey: ['banquets'] });
      showNotice('success', 'Booking recorded.');
    },
    onError: (err: Error) => showNotice('error', err.message),
  });

  const packages = packagesQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Banquets"
        description="Packages and event bookings for catering and hotel banquet halls."
      />

      <section className="space-y-4">
        <h2 className="font-semibold">Packages</h2>
        <div className="grid gap-3 rounded-xl border border-white/5 bg-bg-card p-4 sm:grid-cols-3">
          <Input
            label="Package name"
            placeholder="Grand Ballroom"
            value={pkg.name}
            onChange={(e) => setPkg({ ...pkg, name: e.target.value })}
          />
          <Input
            label="Capacity"
            type="number"
            value={pkg.capacity}
            onChange={(e) => setPkg({ ...pkg, capacity: e.target.value })}
          />
          <Input
            label="Base rate (₹)"
            type="number"
            value={pkg.baseRate}
            onChange={(e) => setPkg({ ...pkg, baseRate: e.target.value })}
          />
          <div className="sm:col-span-3">
            <Button
              onClick={() => createPackageMutation.mutate()}
              disabled={!pkg.name.trim()}
              loading={createPackageMutation.isPending}
            >
              Add package
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/5 bg-bg-elevated text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Capacity</th>
                <th className="px-4 py-3 font-medium">Base rate</th>
                <th className="px-4 py-3 font-medium">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {packagesQuery.isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                    Loading…
                  </td>
                </tr>
              ) : packages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                    No banquet packages yet.
                  </td>
                </tr>
              ) : (
                packages.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{p.capacity}</td>
                    <td className="px-4 py-3 font-mono">{formatMoney(Number(p.baseRate))}</td>
                    <td className="px-4 py-3">{p._count?.bookings ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Bookings</h2>
        <div className="grid gap-3 rounded-xl border border-white/5 bg-bg-card p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-secondary">Package</label>
            <select
              value={booking.banquetId}
              onChange={(e) => setBooking({ ...booking, banquetId: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2 text-sm"
            >
              <option value="">Select package</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Event date"
            type="date"
            value={booking.eventDate}
            onChange={(e) => setBooking({ ...booking, eventDate: e.target.value })}
          />
          <Input
            label="Guest name"
            value={booking.guestName}
            onChange={(e) => setBooking({ ...booking, guestName: e.target.value })}
          />
          <Input
            label="Guest phone"
            value={booking.guestPhone}
            onChange={(e) => setBooking({ ...booking, guestPhone: e.target.value })}
          />
          <Input
            label="Guest count"
            type="number"
            value={booking.guestCount}
            onChange={(e) => setBooking({ ...booking, guestCount: e.target.value })}
          />
          <div className="flex items-end">
            <Button
              onClick={() => createBookingMutation.mutate()}
              disabled={!booking.banquetId || !booking.guestName.trim() || !booking.eventDate}
              loading={createBookingMutation.isPending}
            >
              Add booking
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {bookingsQuery.isLoading ? (
            <p className="text-sm text-text-muted">Loading bookings…</p>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-text-muted">No bookings yet.</p>
          ) : (
            bookings.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-bg-card px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {b.guest?.name ?? 'Guest'} · {b.banquet?.name ?? 'Package'}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatDate(b.eventDate)} · {b.guestCount} guests · {b.status}
                  </p>
                </div>
                <span className="font-mono">{formatMoney(Number(b.total))}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
