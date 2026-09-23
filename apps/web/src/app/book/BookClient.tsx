'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:3000/api/v1';

type Slot = {
  startAt: string;
  endAt: string;
  coversAvailable: number;
  available: boolean;
};

type InviteInfo = {
  token: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  orgSlug: string;
  outletSlug: string;
  outletName: string;
  organizationName: string;
};

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || 'Request failed');
  return data as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray((data as { message?: unknown }).message)
      ? ((data as { message: string[] }).message).join(', ')
      : (data as { message?: string }).message;
    throw new Error(msg || 'Request failed');
  }
  return data as T;
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookClient() {
  const search = useSearchParams();
  const inviteToken = search.get('invite') || '';
  const orgSlugParam = search.get('orgSlug') || '';
  const outletSlugParam = search.get('outletSlug') || '';

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [orgSlug, setOrgSlug] = useState(orgSlugParam);
  const [outletSlug, setOutletSlug] = useState(outletSlugParam);
  const [outletName, setOutletName] = useState('');
  const [date, setDate] = useState(todayYmd());
  const [partySize, setPartySize] = useState('2');
  const [slotStart, setSlotStart] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reservedAt: string; outletName: string } | null>(null);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<InviteInfo>(
          `/public/reservations/invite/${encodeURIComponent(inviteToken)}`,
        );
        if (cancelled) return;
        setInvite(data);
        setOrgSlug(data.orgSlug);
        setOutletSlug(data.outletSlug);
        setOutletName(data.outletName);
        setName(data.customerName);
        setPhone(data.customerPhone);
        setEmail(data.customerEmail || '');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Invalid invite');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const loadSlots = useCallback(async () => {
    if (!orgSlug || !outletSlug || !date) return;
    setSlotsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        orgSlug,
        outletSlug,
        date,
        partySize: String(Number(partySize) || 1),
      });
      const data = await apiGet<{
        outletName: string;
        slots: Slot[];
      }>(`/public/reservations/slots?${qs}`);
      setOutletName(data.outletName);
      setSlots(data.slots.filter((s) => s.available));
      setSlotStart('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load slots');
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [orgSlug, outletSlug, date, partySize]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const title = useMemo(() => {
    if (outletName) return `Reserve at ${outletName}`;
    return 'Reserve a table';
  }, [outletName]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slotStart) {
      setError('Select a slot');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiPost<{ reservedAt: string; outletName: string }>(
        '/public/reservations',
        {
          ...(inviteToken
            ? { inviteToken }
            : { orgSlug, outletSlug }),
          customerName: name,
          customerPhone: phone,
          customerEmail: email || undefined,
          partySize: Number(partySize) || 1,
          reservedAt: slotStart,
        },
      );
      setDone({ reservedAt: result.reservedAt, outletName: result.outletName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto min-h-[70vh] max-w-lg px-4 py-16">
        <h1 className="font-display text-3xl font-semibold text-text-primary">You&apos;re booked</h1>
        <p className="mt-3 text-text-secondary">
          Reservation at <strong>{done.outletName}</strong> on{' '}
          {new Date(done.reservedAt).toLocaleString()}. A confirmation was sent when email or SMS
          is available.
        </p>
      </main>
    );
  }

  if (!inviteToken && (!orgSlug || !outletSlug)) {
    return (
      <main className="mx-auto min-h-[70vh] max-w-lg px-4 py-16">
        <h1 className="font-display text-3xl font-semibold">Book a table</h1>
        <p className="mt-3 text-text-secondary">
          Open this page from your restaurant&apos;s invitation or booking link.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-lg px-4 py-12">
      <h1 className="font-display text-3xl font-semibold text-text-primary">{title}</h1>
      {invite ? (
        <p className="mt-2 text-sm text-text-secondary">
          Invitation from {invite.organizationName}. Pick a slot below.
        </p>
      ) : (
        <p className="mt-2 text-sm text-text-secondary">Choose an available slot and your details.</p>
      )}

      {error ? (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block text-text-secondary">Date</span>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-text-secondary">Party size</span>
          <input
            type="number"
            min={1}
            required
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-text-secondary">Available slot</span>
          <select
            required
            value={slotStart}
            onChange={(e) => setSlotStart(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm"
          >
            <option value="">{slotsLoading ? 'Loading…' : 'Select a slot'}</option>
            {slots.map((s) => (
              <option key={s.startAt} value={s.startAt}>
                {new Date(s.startAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {s.coversAvailable} left
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-text-secondary">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-text-secondary">Phone</span>
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-text-secondary">Email (optional)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="btn-pill-filled btn-pill w-full justify-center disabled:opacity-60"
        >
          {loading ? 'Booking…' : 'Confirm reservation'}
        </button>
      </form>
    </main>
  );
}
