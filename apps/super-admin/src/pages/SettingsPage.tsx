import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PhoneField } from '@cullinos/ui';
import {
  type PlatformSettingsField,
  type PlatformSettingsGroup,
  superAdminApi,
} from '@/lib/api';

const OTP_DISABLE_DURATIONS = [
  { ms: 15 * 60 * 1000, label: '15 minutes' },
  { ms: 30 * 60 * 1000, label: '30 minutes' },
  { ms: 60 * 60 * 1000, label: '1 hour' },
  { ms: 3 * 60 * 60 * 1000, label: '3 hours' },
  { ms: 6 * 60 * 60 * 1000, label: '6 hours' },
  { ms: 12 * 60 * 60 * 1000, label: '12 hours' },
  { ms: 24 * 60 * 60 * 1000, label: '24 hours' },
] as const;

const DEFAULT_DISABLE_MS = OTP_DISABLE_DURATIONS[0].ms;

type OtpGateDraft = {
  status: 'enabled' | 'disabled';
  durationMs: number;
  /** Snapshot of server value when form loaded — used to detect changes. */
  serverValue: string;
};

function isFutureIso(value: string | null | undefined, now = Date.now()): boolean {
  const raw = (value ?? '').trim();
  if (!raw) return false;
  const until = Date.parse(raw);
  return !Number.isNaN(until) && until > now;
}

function formatUntil(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function sourceBadge(source: PlatformSettingsField['source']) {
  const styles =
    source === 'database'
      ? 'border-status-success/30 bg-status-success/10 text-status-success'
      : source === 'environment'
        ? 'border-white/15 bg-white/5 text-text-secondary'
        : 'border-status-warning/30 bg-status-warning/10 text-status-warning';
  const label =
    source === 'database' ? 'Database' : source === 'environment' ? 'Environment' : 'Missing';
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles}`}>
      {label}
    </span>
  );
}

function OtpGateField({
  field,
  draft,
  onChange,
  onClear,
  clearPending,
}: {
  field: PlatformSettingsField;
  draft: OtpGateDraft;
  onChange: (next: OtpGateDraft) => void;
  onClear: () => void;
  clearPending: boolean;
}) {
  const currentlyDisabled = isFutureIso(field.value);
  const selectClass =
    'w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent';

  return (
    <div className="block sm:col-span-2">
      <span className="mb-1.5 flex items-center gap-2 text-sm text-text-secondary">
        {field.label}
        {sourceBadge(field.source)}
      </span>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-text-muted">Status</span>
          <select
            value={draft.status}
            onChange={(e) =>
              onChange({
                ...draft,
                status: e.target.value === 'disabled' ? 'disabled' : 'enabled',
              })
            }
            className={selectClass}
          >
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-text-muted">Disable for</span>
          <select
            value={String(draft.durationMs)}
            disabled={draft.status !== 'disabled'}
            onChange={(e) =>
              onChange({
                ...draft,
                durationMs: Number(e.target.value) || DEFAULT_DISABLE_MS,
              })
            }
            className={`${selectClass} disabled:opacity-50`}
          >
            {OTP_DISABLE_DURATIONS.map((d) => (
              <option key={d.ms} value={d.ms}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {currentlyDisabled && field.value ? (
        <p className="mt-2 text-xs text-status-warning">
          Currently disabled until {formatUntil(field.value)}. Saving Disabled renews the window;
          saving Enabled turns OTP back on immediately.
        </p>
      ) : (
        <p className="mt-2 text-xs text-text-muted">
          Disable for a selected period; OTP turns back on automatically when the window ends.
        </p>
      )}
      <span className="mt-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-text-muted">{field.key}</span>
        {field.source === 'database' ? (
          <button
            type="button"
            onClick={onClear}
            disabled={clearPending}
            className="text-[11px] text-text-muted hover:text-status-warning"
          >
            Clear override
          </button>
        ) : null}
      </span>
    </div>
  );
}

function GroupForm({
  group,
  encryptionConfigured,
  onSaved,
}: {
  group: PlatformSettingsGroup;
  encryptionConfigured: boolean;
  onSaved: (msg: string) => void;
}) {
  // Anchor id used by Cullinos App → App settings (`/settings#guest_app`)
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [otpGates, setOtpGates] = useState<Record<string, OtpGateDraft>>({});
  const [error, setError] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    const gates: Record<string, OtpGateDraft> = {};
    for (const field of group.fields) {
      if (field.control === 'otp_gate') {
        const serverValue = field.value ?? '';
        gates[field.key] = {
          status: isFutureIso(serverValue) ? 'disabled' : 'enabled',
          durationMs: DEFAULT_DISABLE_MS,
          serverValue,
        };
        next[field.key] = serverValue;
      } else {
        next[field.key] = field.isSecret ? '' : (field.value ?? '');
      }
    }
    setDraft(next);
    setOtpGates(gates);
    setError(null);
    setTestMsg(null);
  }, [group]);

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, string>) =>
      superAdminApi.updateSettingsGroup(group.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'settings'] });
      onSaved(`${group.label} saved`);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const [testEmail, setTestEmail] = useState('');
  const testSmtpMutation = useMutation({
    mutationFn: () => superAdminApi.testSmtp(testEmail || undefined),
    onSuccess: (r) => setTestMsg(r.ok ? r.message : `Failed: ${r.message}`),
    onError: (err: Error) => setTestMsg(err.message),
  });

  const [testPhone, setTestPhone] = useState('');
  const testMsg91Mutation = useMutation({
    mutationFn: () => superAdminApi.testMsg91(testPhone || undefined),
    onSuccess: (r) => setTestMsg(r.ok ? r.message : `Failed: ${r.message}`),
    onError: (err: Error) => setTestMsg(err.message),
  });

  function resolveOtpGateValue(gate: OtpGateDraft): string {
    if (gate.status === 'enabled') return '';
    return new Date(Date.now() + gate.durationMs).toISOString();
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const values: Record<string, string> = {};
    for (const field of group.fields) {
      if (field.control === 'otp_gate') {
        const gate = otpGates[field.key];
        if (!gate) continue;
        const currentlyDisabled = isFutureIso(gate.serverValue);
        if (gate.status === 'enabled') {
          // Clear only when a disable window (or stale timestamp) is stored.
          if (currentlyDisabled || gate.serverValue.trim()) {
            values[field.key] = '';
          }
        } else {
          // Disabled: always write a fresh until timestamp (renews on each save).
          values[field.key] = resolveOtpGateValue(gate);
        }
        continue;
      }

      const raw = draft[field.key] ?? '';
      if (field.isSecret) {
        if (raw !== '') values[field.key] = raw;
      } else {
        const current = field.value ?? '';
        if (raw !== current) values[field.key] = raw;
      }
    }
    if (Object.keys(values).length === 0) {
      setError('No changes to save');
      return;
    }
    saveMutation.mutate(values);
  }

  function clearOverride(key: string) {
    saveMutation.mutate({ [key]: '' });
  }

  const needsEncryption = group.fields.some((f) => f.isSecret);

  return (
    <form
      id={group.id}
      onSubmit={handleSave}
      className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-6 scroll-mt-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">{group.label}</h2>
          <p className="mt-1 text-sm text-text-muted">{group.description}</p>
        </div>
        {needsEncryption && !encryptionConfigured ? (
          <p className="text-xs text-status-warning">
            Set ENCRYPTION_KEY on the API to save secrets.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
          {error}
        </div>
      ) : null}
      {testMsg ? (
        <div className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm text-text-secondary">
          {testMsg}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {group.fields.map((field) => {
          if (field.control === 'otp_gate') {
            const gate = otpGates[field.key] ?? {
              status: 'enabled' as const,
              durationMs: DEFAULT_DISABLE_MS,
              serverValue: field.value ?? '',
            };
            return (
              <OtpGateField
                key={field.key}
                field={field}
                draft={gate}
                onChange={(next) =>
                  setOtpGates((prev) => ({ ...prev, [field.key]: next }))
                }
                onClear={() => clearOverride(field.key)}
                clearPending={saveMutation.isPending}
              />
            );
          }

          return (
            <label key={field.key} className="block sm:col-span-1">
              <span className="mb-1.5 flex items-center gap-2 text-sm text-text-secondary">
                {field.label}
                {sourceBadge(field.source)}
              </span>
              <input
                type={field.isSecret ? 'password' : 'text'}
                autoComplete="off"
                placeholder={
                  field.isSecret
                    ? field.configured
                      ? field.masked ?? '•••• configured — leave blank to keep'
                      : 'Not set'
                    : undefined
                }
                value={draft[field.key] ?? ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
              />
              <span className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-text-muted">{field.key}</span>
                {field.source === 'database' ? (
                  <button
                    type="button"
                    onClick={() => clearOverride(field.key)}
                    disabled={saveMutation.isPending}
                    className="text-[11px] text-text-muted hover:text-status-warning"
                  >
                    Clear override
                  </button>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-primary hover:opacity-90 disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </button>

        {group.id === 'smtp' ? (
          <>
            <input
              type="email"
              placeholder="Test email (optional)"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-56 rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-brand-accent"
            />
            <button
              type="button"
              onClick={() => testSmtpMutation.mutate()}
              disabled={testSmtpMutation.isPending}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
            >
              {testSmtpMutation.isPending ? 'Testing…' : 'Test SMTP'}
            </button>
          </>
        ) : null}

        {group.id === 'msg91' ? (
          <>
            <div className="min-w-[16rem]">
              <PhoneField
                label="Test phone"
                value={testPhone}
                onChange={setTestPhone}
              />
            </div>
            <button
              type="button"
              onClick={() => testMsg91Mutation.mutate()}
              disabled={testMsg91Mutation.isPending}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
            >
              {testMsg91Mutation.isPending ? 'Testing…' : 'Test MSG91'}
            </button>
          </>
        ) : null}
      </div>
    </form>
  );
}

export function SettingsPage() {
  const [banner, setBanner] = useState<string | null>(null);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['super-admin', 'settings'],
    queryFn: superAdminApi.getSettings,
  });

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || isLoading || !data) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isLoading, data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Platform settings</h1>
          <p className="mt-1 max-w-2xl text-text-secondary">
            Configure SMTP (staff OTP), MSG91 (phone OTP), FCM (Cullinos App push), Razorpay, and
            Cullinos App release flags. Database values override environment variables. No Google
            Sign-In group in this release.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {banner ? (
        <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {banner}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load settings'}
        </div>
      ) : null}

      {data && !data.encryptionConfigured ? (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          ENCRYPTION_KEY is not set on the API. You can still save non-secret fields; secrets
          require encryption.
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-text-muted">Loading settings…</p>
      ) : (
        <div className="space-y-6">
          {data?.groups.map((group) => (
            <GroupForm
              key={group.id}
              group={group}
              encryptionConfigured={data.encryptionConfigured}
              onSaved={(msg) => {
                setBanner(msg);
                window.setTimeout(() => setBanner(null), 3000);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
