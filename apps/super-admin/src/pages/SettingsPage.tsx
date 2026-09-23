import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PhoneField } from '@cullinos/ui';
import {
  type PlatformSettingsField,
  type PlatformSettingsGroup,
  superAdminApi,
} from '@/lib/api';

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
  const [error, setError] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const field of group.fields) {
      next[field.key] = field.isSecret ? '' : (field.value ?? '');
    }
    setDraft(next);
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

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const values: Record<string, string> = {};
    for (const field of group.fields) {
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
        {group.fields.map((field) => (
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
        ))}
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
              {testSmtpMutation.isPending ? 'Sending…' : 'Test SMTP'}
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
              {testMsg91Mutation.isPending ? 'Sending…' : 'Test MSG91'}
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

