import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { Button, PhoneField, cn } from '@cullinos/ui';
import { PageHeader, SectionCard, StatusPill, useConfirm, type PillTone } from '@/components/ui';
import { inputClass, Notice } from '@/components/common';
import { type PlatformSettingsField, type PlatformSettingsGroup, superAdminApi } from '@/lib/api';

const WHATSAPP_MARKETING_ID = 'whatsapp_marketing';

function SourcePill({ source }: { source: PlatformSettingsField['source'] }) {
  const map: Record<string, { label: string; tone: PillTone }> = {
    database: { label: 'Database', tone: 'success' },
    environment: { label: 'Environment', tone: 'neutral' },
    default: { label: 'Default', tone: 'neutral' },
  };
  const s = map[source] ?? { label: 'Missing', tone: 'warning' as const };
  return <StatusPill status={source} tone={s.tone} label={s.label} dot={false} />;
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
  const queryClient = useQueryClient();
  const [confirm, confirmDialog] = useConfirm();
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
    mutationFn: (values: Record<string, string>) => superAdminApi.updateSettingsGroup(group.id, values),
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

  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappTestMessage, setWhatsappTestMessage] = useState('Cullinos WhatsApp test');
  const testWhatsappMutation = useMutation({
    mutationFn: () => superAdminApi.testWhatsapp(whatsappPhone, whatsappTestMessage),
    onSuccess: (r) => setTestMsg(r.ok ? r.message : `Failed: ${r.message}`),
    onError: (err: Error) => setTestMsg(err.message),
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const values: Record<string, string> = {};
    for (const field of group.fields) {
      if (field.type === 'boolean') continue;
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

  async function toggleBoolean(field: PlatformSettingsField) {
    const next = field.value === 'false' ? 'true' : 'false';
    if (next === 'false' && group.id === 'portals') {
      const ok = await confirm({
        title: `Turn off "${field.label}" for every tenant?`,
        description: 'Signed-in users are blocked on their next request.',
        confirmLabel: 'Turn off',
      });
      if (!ok) return;
    }
    saveMutation.mutate({ [field.key]: next });
  }

  const needsEncryption = group.fields.some((f) => f.isSecret);
  const textFields = group.fields.filter((f) => f.type !== 'boolean');

  return (
    <SectionCard title={group.label} description={group.description}>
      {confirmDialog}
      <form id={group.id} onSubmit={handleSave} className="space-y-5">
        {needsEncryption && !encryptionConfigured ? (
          <Notice tone="warning">Set ENCRYPTION_KEY on the API to save secrets in this section.</Notice>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        {testMsg ? <Notice tone={testMsg.startsWith('Failed') ? 'error' : 'info'}>{testMsg}</Notice> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {group.fields.map((field) =>
            field.type === 'boolean' ? (
              <div key={field.key} className="flex items-center justify-between gap-3 rounded-xl border border-line-subtle bg-bg-secondary px-4 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {field.label}
                    <SourcePill source={field.source} />
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-text-muted">{field.key}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value !== 'false'}
                  aria-label={field.label}
                  disabled={saveMutation.isPending}
                  onClick={() => void toggleBoolean(field)}
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60',
                    field.value !== 'false' ? 'bg-accent' : 'bg-hover-strong',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                      field.value !== 'false' ? 'left-[22px]' : 'left-0.5',
                    )}
                  />
                </button>
              </div>
            ) : (
              <label key={field.key} className="block">
                <span className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-medium text-text-secondary">
                  {field.label}
                  <SourcePill source={field.source} />
                </span>
                <input
                  type={field.isSecret ? 'password' : 'text'}
                  autoComplete="off"
                  placeholder={
                    field.isSecret ? (field.configured ? (field.masked ?? '•••• configured — leave blank to keep') : 'Not set') : undefined
                  }
                  value={draft[field.key] ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className={inputClass}
                />
                <span className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-text-muted">{field.key}</span>
                  {field.source === 'database' ? (
                    <button
                      type="button"
                      onClick={() => saveMutation.mutate({ [field.key]: '' })}
                      disabled={saveMutation.isPending}
                      className="text-[11px] text-text-muted hover:text-status-warning"
                    >
                      Clear override
                    </button>
                  ) : null}
                </span>
              </label>
            ),
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-line-subtle pt-4">
          {textFields.length > 0 ? (
            <Button type="submit" size="sm" loading={saveMutation.isPending}>
              Save changes
            </Button>
          ) : null}

          {group.id === 'smtp' ? (
            <>
              <input
                type="email"
                aria-label="Test email"
                placeholder="Test email (optional)"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className={`${inputClass} w-56`}
              />
              <Button type="button" size="sm" variant="secondary" loading={testSmtpMutation.isPending} onClick={() => testSmtpMutation.mutate()}>
                Test SMTP
              </Button>
            </>
          ) : null}

          {group.id === 'msg91' ? (
            <>
              <div className="min-w-[16rem]">
                <PhoneField label="Test phone" value={testPhone} onChange={setTestPhone} />
              </div>
              <Button type="button" size="sm" variant="secondary" loading={testMsg91Mutation.isPending} onClick={() => testMsg91Mutation.mutate()}>
                Test MSG91
              </Button>
            </>
          ) : null}

          {group.id === 'whatsapp' ? (
            <>
              <div className="min-w-[16rem]">
                <PhoneField label="Test phone" value={whatsappPhone} onChange={setWhatsappPhone} />
              </div>
              <input
                type="text"
                aria-label="Test message"
                placeholder="Test message"
                value={whatsappTestMessage}
                onChange={(e) => setWhatsappTestMessage(e.target.value)}
                className={`${inputClass} min-w-[16rem] flex-1`}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={testWhatsappMutation.isPending}
                disabled={!whatsappPhone.trim() || !whatsappTestMessage.trim()}
                onClick={() => testWhatsappMutation.mutate()}
              >
                Send test
              </Button>
            </>
          ) : null}
        </div>
      </form>
    </SectionCard>
  );
}

function parseRecipientPhones(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean))];
}

function WhatsappMarketingSection() {
  const [message, setMessage] = useState('');
  const [phonesText, setPhonesText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const phones = parseRecipientPhones(phonesText);

  const sendMutation = useMutation({
    mutationFn: () => superAdminApi.sendWhatsappMarketing(phones, message.trim()),
    onSuccess: (result) => {
      setError(null);
      setNotice(result.message);
    },
    onError: (err: Error) => {
      setNotice(null);
      setError(err.message);
    },
  });

  return (
    <SectionCard
      title="WhatsApp marketing"
      description="Draft a message and send it to the numbers you enter. WhatsApp delivers it as the approved marketing template's body variable, configured in the WhatsApp section. Create and approve that template in the MSG91 panel first."
    >
      <div id={WHATSAPP_MARKETING_ID} className="space-y-4">
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-secondary">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={1024}
            placeholder="Text that fills the template body variable"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-secondary">Recipient numbers ({phones.length})</span>
          <textarea
            value={phonesText}
            onChange={(e) => setPhonesText(e.target.value)}
            rows={4}
            placeholder="One number per line, or separated by commas"
            className={inputClass}
          />
        </label>
        <Button size="sm" loading={sendMutation.isPending} disabled={!message.trim() || phones.length === 0} onClick={() => sendMutation.mutate()}>
          <Send size={16} aria-hidden="true" />
          Send on WhatsApp
        </Button>
      </div>
    </SectionCard>
  );
}

export function SettingsPage() {
  const [banner, setBanner] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(() => window.location.hash.replace(/^#/, '') || null);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['super-admin', 'settings'],
    queryFn: superAdminApi.getSettings,
  });

  const groups = data?.groups ?? [];
  const validIds = [...groups.map((g) => g.id), WHATSAPP_MARKETING_ID];
  const current = activeId && validIds.includes(activeId) ? activeId : (groups[0]?.id ?? null);
  const activeGroup = groups.find((g) => g.id === current);

  useEffect(() => {
    const onHash = () => setActiveId(window.location.hash.replace(/^#/, '') || null);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function select(id: string) {
    setActiveId(id);
    window.history.replaceState(null, '', `#${id}`);
  }

  const navItems = [
    ...groups.map((g) => ({
      id: g.id,
      label: g.label,
      configured: g.fields.filter((f) => f.configured || f.source === 'database').length,
      total: g.fields.length,
    })),
    { id: WHATSAPP_MARKETING_ID, label: 'WhatsApp marketing', configured: null as number | null, total: 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform settings"
        description="Client portals, SMTP (staff OTP), MSG91 (phone OTP and WhatsApp), Firebase Admin for Cullinos App auth/push, Razorpay and Cullinos App release flags. Database values override environment variables."
        actions={
          <Button size="sm" variant="secondary" loading={isFetching} onClick={() => refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {banner ? <Notice tone="success">{banner}</Notice> : null}
      {error ? <Notice tone="error">{error instanceof Error ? error.message : 'Failed to load settings'}</Notice> : null}
      {data && !data.encryptionConfigured ? (
        <Notice tone="warning">ENCRYPTION_KEY is not set on the API. You can still save non-secret fields; secrets require encryption.</Notice>
      ) : null}

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="h-80 animate-pulse rounded-xl bg-bg-secondary" />
          <div className="h-96 animate-pulse rounded-xl bg-bg-secondary" />
        </div>
      ) : data ? (
        <div className="grid items-start gap-6 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Settings sections" className="lg:sticky lg:top-24">
            <ul className="flex gap-1 overflow-x-auto rounded-xl border border-line-subtle bg-bg-card p-2 lg:flex-col sa-scroll">
              {navItems.map((item) => {
                const active = item.id === current;
                return (
                  <li key={item.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => select(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        active ? 'bg-accent/10 font-medium text-accent' : 'text-text-secondary hover:bg-hover hover:text-text-primary',
                      )}
                    >
                      <span className="whitespace-nowrap">{item.label}</span>
                      {item.configured != null && item.total > 0 ? (
                        <span className="text-xs tabular-nums text-text-muted">
                          {item.configured}/{item.total}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="min-w-0">
            {current === WHATSAPP_MARKETING_ID ? (
              <WhatsappMarketingSection />
            ) : activeGroup ? (
              <GroupForm
                key={activeGroup.id}
                group={activeGroup}
                encryptionConfigured={data.encryptionConfigured}
                onSaved={(msg) => {
                  setBanner(msg);
                  window.setTimeout(() => setBanner(null), 3000);
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
