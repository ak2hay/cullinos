import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
  useToast,
} from '@cullinos/ui';
import {
  DEFAULT_GUEST_THEME_KEY,
  GUEST_THEME_PRESET_LIST,
  resolveGuestThemePreset,
  type GuestThemePresetKey,
} from '@cullinos/shared';
import {
  IMAGE_SLOT_HINTS,
  ImageUploadField,
  validateClientImageFile,
} from '@/components/ImageUploadField';
import { outletsApi, type Outlet, type OutletPhoto, API_BASE } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

type DayKey = (typeof DAY_KEYS)[number];
type DayHours = { closed: boolean; open: string; close: string };
type OpeningHours = Record<DayKey, DayHours>;

function defaultOpeningHours(): OpeningHours {
  return Object.fromEntries(
    DAY_KEYS.map((d) => [d, { closed: false, open: '09:00', close: '22:00' }]),
  ) as OpeningHours;
}

function parseOpeningHours(raw: unknown): OpeningHours {
  const base = defaultOpeningHours();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const src = raw as Record<string, unknown>;
  for (const day of DAY_KEYS) {
    const entry = src[day];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    base[day] = {
      closed: Boolean(e.closed),
      open: typeof e.open === 'string' ? e.open : '09:00',
      close: typeof e.close === 'string' ? e.close : '22:00',
    };
  }
  return base;
}

async function lookupPincodeIN(pin: string): Promise<{ city: string; state: string } | null> {
  if (!/^\d{6}$/.test(pin)) return null;
  try {
    const res = await fetch(`${API_BASE}/geo/pincode/${pin}`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      found?: boolean;
      city?: string | null;
      state?: string | null;
    };
    if (!json.found || !json.city) return null;
    return { city: json.city, state: json.state ?? '' };
  } catch {
    return null;
  }
}

export function MarketplaceListingPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const [outletId, setOutletId] = useState('');
  const [form, setForm] = useState({
    marketplaceListed: false,
    latitude: '',
    longitude: '',
    cuisineTags: '',
    coverImageUrl: '',
    averagePrepMinutes: '',
    address: '',
    pincode: '',
    city: '',
    state: '',
    guestThemeKey: DEFAULT_GUEST_THEME_KEY as GuestThemePresetKey,
  });
  const [openingHours, setOpeningHours] = useState<OpeningHours>(defaultOpeningHours);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const photosQuery = useQuery({
    queryKey: ['outlets', outletId, 'photos'],
    queryFn: () => outletsApi.listPhotos(outletId),
    enabled: Boolean(outletId),
  });
  const photos: OutletPhoto[] = photosQuery.data ?? [];

  useEffect(() => {
    if (outletId) return;
    if (selectedOutletId) {
      setOutletId(selectedOutletId);
      return;
    }
    if (outletsQuery.data?.[0]?.id) setOutletId(outletsQuery.data[0].id);
  }, [outletId, selectedOutletId, outletsQuery.data]);

  useEffect(() => {
    const outlet = (outletsQuery.data ?? []).find((o) => o.id === outletId) as
      | Outlet
      | undefined;
    if (!outlet) return;
    setForm({
      marketplaceListed: Boolean(outlet.marketplaceListed),
      latitude: outlet.latitude != null ? String(outlet.latitude) : '',
      longitude: outlet.longitude != null ? String(outlet.longitude) : '',
      cuisineTags: (outlet.cuisineTags ?? []).join(', '),
      coverImageUrl: outlet.coverImageUrl ?? '',
      averagePrepMinutes:
        outlet.averagePrepMinutes != null ? String(outlet.averagePrepMinutes) : '',
      address: outlet.address ?? '',
      pincode: outlet.pincode ?? '',
      city: outlet.city ?? '',
      state: outlet.state ?? '',
      guestThemeKey: resolveGuestThemePreset(outlet.guestThemeKey).key,
    });
    setOpeningHours(parseOpeningHours(outlet.openingHours));
  }, [outletId, outletsQuery.data]);

  const listingBlockedReason = useMemo(() => {
    if (!form.marketplaceListed) return null;
    const lat = form.latitude.trim();
    const lng = form.longitude.trim();
    if (!lat || !lng || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
      return 'Latitude and longitude are required to list on the marketplace.';
    }
    const hasOpenDay = DAY_KEYS.some((d) => !openingHours[d].closed);
    if (!hasOpenDay) {
      return 'Set at least one open day before listing on the marketplace.';
    }
    return null;
  }, [form.marketplaceListed, form.latitude, form.longitude, openingHours]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (listingBlockedReason) {
        return Promise.reject(new Error(listingBlockedReason));
      }
      const preset = resolveGuestThemePreset(form.guestThemeKey);
      return outletsApi.update(outletId, {
        marketplaceListed: form.marketplaceListed,
        latitude: form.latitude.trim() ? Number(form.latitude) : null,
        longitude: form.longitude.trim() ? Number(form.longitude) : null,
        cuisineTags: form.cuisineTags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        coverImageUrl: form.coverImageUrl.trim() || null,
        averagePrepMinutes: form.averagePrepMinutes.trim()
          ? Number(form.averagePrepMinutes)
          : null,
        address: form.address.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        openingHours,
        guestThemeKey: form.guestThemeKey,
        primaryColor: preset.primary,
        accentColor: preset.bright,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
      toast.success('Marketplace listing saved.');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save.'),
  });

  async function handlePincodeBlur() {
    const pin = form.pincode.trim();
    if (!/^\d{6}$/.test(pin) || (form.city && form.state)) return;
    setPincodeLoading(true);
    try {
      const result = await lookupPincodeIN(pin);
      if (result) {
        setForm((f) => ({
          ...f,
          city: f.city || result.city,
          state: f.state || result.state,
        }));
      }
    } finally {
      setPincodeLoading(false);
    }
  }

  async function handleCoverUpload(file: File): Promise<string> {
    if (!outletId) throw new Error('Select an outlet first.');
    const result = await outletsApi.uploadCoverImage(outletId, file);
    queryClient.invalidateQueries({ queryKey: ['outlets'] });
    toast.success('Cover image uploaded.');
    return result.coverImageUrl ?? '';
  }

  async function handleGalleryFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !outletId) return;
    if (photos.length >= 8) {
      toast.error('Maximum 8 restaurant photos.');
      return;
    }
    setGalleryUploading(true);
    try {
      await validateClientImageFile(file, IMAGE_SLOT_HINTS.outletGallery);
      await outletsApi.uploadPhoto(outletId, file, { setAsCover: photos.length === 0 });
      queryClient.invalidateQueries({ queryKey: ['outlets', outletId, 'photos'] });
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
      toast.success('Restaurant photo added.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setGalleryUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  }

  function updateDay(day: DayKey, patch: Partial<DayHours>) {
    setOpeningHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
  }

  const outletOptions = (outletsQuery.data ?? []).map((o) => ({
    value: o.id,
    label: o.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="App listing"
        description="List this outlet on the Cullinos App marketplace. Guests discover nearby places and scan table QR for dine-in."
      />

      {outletsQuery.error ? (
        <ErrorBanner>
          {outletsQuery.error instanceof Error
            ? outletsQuery.error.message
            : 'Failed to load outlets'}
        </ErrorBanner>
      ) : null}

      <div className="grid gap-3 rounded-xl border border-white/5 bg-bg-card p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Select
            label="Outlet"
            options={outletOptions}
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.marketplaceListed}
            onChange={(e) =>
              setForm((f) => ({ ...f, marketplaceListed: e.target.checked }))
            }
          />
          List on Cullinos App
        </label>
        {listingBlockedReason ? (
          <p className="text-xs text-status-warning sm:col-span-2">{listingBlockedReason}</p>
        ) : null}

        <div className="sm:col-span-2 space-y-2 rounded-lg border border-white/5 bg-bg-elevated/40 p-3">
          <Select
            label="Guest app theme"
            options={GUEST_THEME_PRESET_LIST.map((p) => ({
              value: p.key,
              label: `${p.label} — ${p.description}`,
            }))}
            value={form.guestThemeKey}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                guestThemeKey: e.target.value as GuestThemePresetKey,
              }))
            }
          />
          <p className="text-xs text-text-muted">
            Applied inside the restaurant after a guest selects or scans this outlet.
            Marketplace home stays Cullinos green.
          </p>
        </div>

        <Input
          label="Latitude *"
          placeholder="12.9716"
          value={form.latitude}
          onChange={(e) => setForm({ ...form, latitude: e.target.value })}
        />
        <Input
          label="Longitude *"
          placeholder="77.5946"
          value={form.longitude}
          onChange={(e) => setForm({ ...form, longitude: e.target.value })}
        />
        <Input
          label="Cuisine tags (comma-separated)"
          placeholder="cafe, south indian, coffee"
          value={form.cuisineTags}
          onChange={(e) => setForm({ ...form, cuisineTags: e.target.value })}
        />
        <Input
          label="Avg prep minutes"
          type="number"
          value={form.averagePrepMinutes}
          onChange={(e) => setForm({ ...form, averagePrepMinutes: e.target.value })}
        />

        <div className="sm:col-span-2 space-y-3">
          <ImageUploadField
            slot="outletCover"
            value={form.coverImageUrl}
            onChange={(url) => setForm((f) => ({ ...f, coverImageUrl: url }))}
            onUpload={handleCoverUpload}
            disabled={!outletId}
          />
          <Input
            label="Or paste cover image URL"
            placeholder="https://..."
            value={form.coverImageUrl}
            onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
          />
        </div>

        <div className="sm:col-span-2 space-y-3 rounded-lg border border-white/5 bg-bg-elevated/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-text-secondary">Restaurant photos</p>
              <p className="text-xs text-text-muted">
                Gallery shown on the guest app menu (up to 8). Recommended 1200×900px (4:3),
                PNG/JPG/WebP, max 5 MB. Cover is used as the hero.
              </p>
            </div>
            <div>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={!outletId || galleryUploading || photos.length >= 8}
                onChange={handleGalleryFileChange}
              />
              <Button
                type="button"
                variant="secondary"
                loading={galleryUploading}
                disabled={!outletId || photos.length >= 8}
                onClick={() => galleryInputRef.current?.click()}
              >
                Add photo
              </Button>
            </div>
          </div>
          {photosQuery.isLoading ? (
            <p className="text-xs text-text-muted">Loading photos…</p>
          ) : photos.length === 0 ? (
            <p className="text-xs text-text-muted">No gallery photos yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((photo) => {
                const isCover = form.coverImageUrl === photo.url;
                return (
                  <div key={photo.id} className="space-y-2">
                    <img
                      src={photo.url}
                      alt={photo.caption ?? 'Restaurant'}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isCover}
                        onClick={async () => {
                          try {
                            const res = await outletsApi.setPhotoCover(outletId, photo.id);
                            setForm((f) => ({
                              ...f,
                              coverImageUrl: res.coverImageUrl ?? photo.url,
                            }));
                            queryClient.invalidateQueries({ queryKey: ['outlets'] });
                            toast.success('Cover updated.');
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Failed.');
                          }
                        }}
                      >
                        {isCover ? 'Cover' : 'Set cover'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await outletsApi.deletePhoto(outletId, photo.id);
                            queryClient.invalidateQueries({
                              queryKey: ['outlets', outletId, 'photos'],
                            });
                            queryClient.invalidateQueries({ queryKey: ['outlets'] });
                            toast.success('Photo removed.');
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Failed.');
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sm:col-span-2 space-y-3 rounded-lg border border-white/5 p-3">
          <div>
            <p className="text-sm font-medium">Opening hours *</p>
            <p className="text-xs text-text-muted">
              Required for marketplace listing. Times use the outlet organisation timezone (default Asia/Kolkata).
            </p>
          </div>
          <div className="space-y-2">
            {DAY_KEYS.map((day) => {
              const row = openingHours[day];
              return (
                <div
                  key={day}
                  className="grid grid-cols-[52px_1fr_1fr_auto] items-end gap-2"
                >
                  <p className="pb-2 text-sm font-medium text-text-secondary">
                    {DAY_LABELS[day]}
                  </p>
                  <Input
                    label="Open"
                    type="time"
                    value={row.open}
                    disabled={row.closed}
                    onChange={(e) => updateDay(day, { open: e.target.value })}
                  />
                  <Input
                    label="Close"
                    type="time"
                    value={row.close}
                    disabled={row.closed}
                    onChange={(e) => updateDay(day, { close: e.target.value })}
                  />
                  <label className="flex items-center gap-2 pb-2 text-sm whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={row.closed}
                      onChange={(e) => updateDay(day, { closed: e.target.checked })}
                    />
                    Closed
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <Input
          label="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <div className="space-y-1">
          <Input
            label={`Pincode${pincodeLoading ? ' (looking up…)' : ''}`}
            value={form.pincode}
            onChange={(e) => setForm({ ...form, pincode: e.target.value })}
            onBlur={() => void handlePincodeBlur()}
          />
          {!pincodeLoading && form.pincode && !/^\d{6}$/.test(form.pincode) ? (
            <p className="text-xs text-status-warning">Enter a 6-digit Indian pincode to autofill city/state.</p>
          ) : null}
        </div>
        <Input
          label="City"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
        <Input
          label="State"
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
        />

        <div className="flex items-end sm:col-span-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!outletId || Boolean(listingBlockedReason)}
            loading={saveMutation.isPending}
          >
            Save listing
          </Button>
        </div>
      </div>
    </div>
  );
}
