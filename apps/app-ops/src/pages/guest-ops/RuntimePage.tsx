import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import {
  DEFAULT_GUEST_THEME_KEY,
  GUEST_THEME_PRESET_LIST,
  resolveGuestThemePreset,
  type GuestThemePresetKey,
} from '@cullinos/shared';
import { guestOpsApi } from '@/lib/api';

type FormState = {
  GUEST_APP_MIN_VERSION: string;
  GUEST_APP_FORCE_UPDATE: string;
  GUEST_APP_SOFT_UPDATE_MESSAGE: string;
  GUEST_APP_MAINTENANCE: string;
  GUEST_APP_PLAY_STORE_URL: string;
  GUEST_APP_SUPPORT_URL: string;
  GUEST_APP_PRIVACY_URL: string;
  GUEST_APP_TERMS_URL: string;
  GUEST_APP_FEATURE_FLAGS: string;
  GUEST_APP_PHONE_MENU_QR_ENABLED: string;
  PLATFORM_DEFAULT_GUEST_THEME_KEY: string;
};

function runtimeToForm(runtime: Awaited<ReturnType<typeof guestOpsApi.runtime>>): FormState {
  return {
    GUEST_APP_MIN_VERSION: String(runtime.minVersionCode ?? 1),
    GUEST_APP_FORCE_UPDATE: runtime.forceUpdate ? 'true' : 'false',
    GUEST_APP_SOFT_UPDATE_MESSAGE: runtime.softUpdateMessage ?? '',
    GUEST_APP_MAINTENANCE: runtime.maintenanceMessage ?? '',
    GUEST_APP_PLAY_STORE_URL: runtime.playStoreUrl ?? '',
    GUEST_APP_SUPPORT_URL: runtime.supportUrl ?? '',
    GUEST_APP_PRIVACY_URL: runtime.privacyUrl ?? '',
    GUEST_APP_TERMS_URL: runtime.termsUrl ?? '',
    GUEST_APP_FEATURE_FLAGS: JSON.stringify(runtime.featureFlags ?? {}, null, 2),
    GUEST_APP_PHONE_MENU_QR_ENABLED: runtime.phoneMenuQrEnabled ? 'true' : 'false',
    PLATFORM_DEFAULT_GUEST_THEME_KEY:
      runtime.platformDefaultGuestThemeKey ?? DEFAULT_GUEST_THEME_KEY,
  };
}

export function GuestOpsRuntimePage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: runtime, isLoading } = useQuery({
    queryKey: ['guest-ops', 'runtime'],
    queryFn: guestOpsApi.runtime,
  });

  useEffect(() => {
    if (runtime) setForm(runtimeToForm(runtime));
  }, [runtime]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error('Form not loaded');
      let featureFlags = form.GUEST_APP_FEATURE_FLAGS.trim();
      if (featureFlags) {
        JSON.parse(featureFlags);
      } else {
        featureFlags = '';
      }
      return guestOpsApi.updateRuntime({
        GUEST_APP_MIN_VERSION: form.GUEST_APP_MIN_VERSION.trim() || null,
        GUEST_APP_FORCE_UPDATE: form.GUEST_APP_FORCE_UPDATE.trim() || null,
        GUEST_APP_SOFT_UPDATE_MESSAGE: form.GUEST_APP_SOFT_UPDATE_MESSAGE.trim() || null,
        GUEST_APP_MAINTENANCE: form.GUEST_APP_MAINTENANCE.trim() || null,
        GUEST_APP_PLAY_STORE_URL: form.GUEST_APP_PLAY_STORE_URL.trim() || null,
        GUEST_APP_SUPPORT_URL: form.GUEST_APP_SUPPORT_URL.trim() || null,
        GUEST_APP_PRIVACY_URL: form.GUEST_APP_PRIVACY_URL.trim() || null,
        GUEST_APP_TERMS_URL: form.GUEST_APP_TERMS_URL.trim() || null,
        GUEST_APP_FEATURE_FLAGS: featureFlags || null,
        GUEST_APP_PHONE_MENU_QR_ENABLED: form.GUEST_APP_PHONE_MENU_QR_ENABLED.trim() || 'false',
        PLATFORM_DEFAULT_GUEST_THEME_KEY:
          form.PLATFORM_DEFAULT_GUEST_THEME_KEY.trim() || DEFAULT_GUEST_THEME_KEY,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'runtime'] });
      queryClient.invalidateQueries({ queryKey: ['guest-ops', 'overview'] });
      setMessage('Runtime settings saved.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const presets = runtime?.guestThemePresets?.length
    ? runtime.guestThemePresets
    : GUEST_THEME_PRESET_LIST;
  const selectedPreset = form
    ? resolveGuestThemePreset(form.PLATFORM_DEFAULT_GUEST_THEME_KEY)
    : resolveGuestThemePreset(DEFAULT_GUEST_THEME_KEY);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">App runtime</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Version gates, maintenance mode, URLs, guest theme defaults, and feature flags served to
          the Cullinos Android app.
        </p>
      </div>

      {runtime ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            runtime.fcmConfigured
              ? 'border-status-success/30 bg-status-success/10 text-status-success'
              : 'border-status-warning/30 bg-status-warning/10 text-status-warning'
          }`}
        >
          FCM push delivery: {runtime.fcmConfigured ? 'configured' : 'not configured'}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      ) : null}

      {isLoading || !form ? (
        <p className="text-sm text-text-muted">Loading runtime config…</p>
      ) : (
        <>
          <section className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="text-lg font-medium">Guest theme defaults</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Platform default when an outlet has no guestThemeKey. Marketplace home/explore/offers
              always stay Cullinos green; restaurant screens use the outlet or this default.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-text-secondary">Default restaurant theme</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
                  value={form.PLATFORM_DEFAULT_GUEST_THEME_KEY}
                  onChange={(e) =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            PLATFORM_DEFAULT_GUEST_THEME_KEY: e.target
                              .value as GuestThemePresetKey,
                          }
                        : f,
                    )
                  }
                >
                  {presets.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label} — {p.description}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-3 pb-1">
                <span
                  className="inline-block h-8 w-8 rounded-full border border-white/10"
                  style={{ backgroundColor: selectedPreset.primary }}
                  title="Primary"
                />
                <span
                  className="inline-block h-8 w-8 rounded-full border border-white/10"
                  style={{ backgroundColor: selectedPreset.soft }}
                  title="Soft"
                />
                <span
                  className="inline-block h-8 w-8 rounded-full border border-white/10"
                  style={{ backgroundColor: selectedPreset.deep }}
                  title="Deep"
                />
                <span className="text-xs text-text-muted">{selectedPreset.label}</span>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() =>
                    setForm((f) =>
                      f ? { ...f, PLATFORM_DEFAULT_GUEST_THEME_KEY: p.key } : f,
                    )
                  }
                  className={`rounded-lg border p-3 text-left text-sm transition ${
                    form.PLATFORM_DEFAULT_GUEST_THEME_KEY === p.key
                      ? 'border-brand-primary bg-brand-primary/10'
                      : 'border-white/10 bg-bg-primary hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 rounded-full"
                      style={{ backgroundColor: p.primary }}
                    />
                    <span className="font-medium">{p.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{p.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="text-lg font-medium">Live preview</h2>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-bg-primary p-3 text-xs text-text-secondary">
              {JSON.stringify(runtime, null, 2)}
            </pre>
          </section>

          <section className="rounded-xl border border-white/5 bg-bg-card p-5">
            <h2 className="text-lg font-medium">Edit settings</h2>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
            >
              <Input
                label="Minimum version code"
                value={form.GUEST_APP_MIN_VERSION}
                onChange={(e) =>
                  setForm((f) => f && { ...f, GUEST_APP_MIN_VERSION: e.target.value })
                }
              />
              <label className="block text-sm">
                <span className="mb-1 block text-text-secondary">Force update</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
                  value={form.GUEST_APP_FORCE_UPDATE}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, GUEST_APP_FORCE_UPDATE: e.target.value })
                  }
                >
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-text-secondary">
                  Phone menu / takeaway QR
                </span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
                  value={form.GUEST_APP_PHONE_MENU_QR_ENABLED}
                  onChange={(e) =>
                    setForm((f) =>
                      f && { ...f, GUEST_APP_PHONE_MENU_QR_ENABLED: e.target.value },
                    )
                  }
                >
                  <option value="false">disabled</option>
                  <option value="true">enabled</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <Input
                  label="Soft update message"
                  value={form.GUEST_APP_SOFT_UPDATE_MESSAGE}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, GUEST_APP_SOFT_UPDATE_MESSAGE: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Maintenance message (empty = off)"
                  value={form.GUEST_APP_MAINTENANCE}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, GUEST_APP_MAINTENANCE: e.target.value })
                  }
                />
              </div>
              <Input
                label="Play Store URL"
                value={form.GUEST_APP_PLAY_STORE_URL}
                onChange={(e) =>
                  setForm((f) => f && { ...f, GUEST_APP_PLAY_STORE_URL: e.target.value })
                }
              />
              <Input
                label="Support URL"
                value={form.GUEST_APP_SUPPORT_URL}
                onChange={(e) =>
                  setForm((f) => f && { ...f, GUEST_APP_SUPPORT_URL: e.target.value })
                }
              />
              <Input
                label="Privacy URL"
                value={form.GUEST_APP_PRIVACY_URL}
                onChange={(e) =>
                  setForm((f) => f && { ...f, GUEST_APP_PRIVACY_URL: e.target.value })
                }
              />
              <Input
                label="Terms URL"
                value={form.GUEST_APP_TERMS_URL}
                onChange={(e) =>
                  setForm((f) => f && { ...f, GUEST_APP_TERMS_URL: e.target.value })
                }
              />
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-text-secondary">Feature flags (JSON)</span>
                <textarea
                  className="min-h-32 w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2 font-mono text-xs"
                  value={form.GUEST_APP_FEATURE_FLAGS}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, GUEST_APP_FEATURE_FLAGS: e.target.value })
                  }
                />
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  Save runtime settings
                </Button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
