import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Lock, Play, ShieldCheck } from 'lucide-react';
import { Button } from '@cullinos/ui';
import {
  ConfirmDialog,
  DataTable,
  FilterSelect,
  PageHeader,
  PageTabs,
  SearchInput,
  SectionCard,
  StatusPill,
} from '@/components/ui';
import { inputClass, Notice } from '@/components/common';
import { ApiRequestError, type Tenant, superAdminApi } from '@/lib/api';

type StepUp = { token: string; expiresAt: number };
type Tab = 'environments' | 'sql' | 'audits';

function EnvPill({ environmentClass }: { environmentClass?: number }) {
  const sandbox = environmentClass === 0;
  return <StatusPill status={sandbox ? 'sandbox' : 'live'} tone={sandbox ? 'warning' : 'success'} label={sandbox ? 'Sandbox' : 'Live'} />;
}

function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => esc(row[c])).join(','));
  }
  return lines.join('\n');
}

function cellText(v: unknown) {
  if (v == null) return '∅';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

export function LabsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('environments');
  const [q, setQ] = useState('');
  const [envFilter, setEnvFilter] = useState<'all' | '0' | '1'>('all');
  const [sql, setSql] = useState('SELECT id, name, slug, environment_class FROM organizations LIMIT 20');
  const [sqlResult, setSqlResult] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
    truncated: boolean;
    durationMs: number;
  } | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stepUp, setStepUp] = useState<StepUp | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [envChange, setEnvChange] = useState<{ tenant: Tenant; nextClass: number } | null>(null);
  const stepUpActive = stepUp != null && stepUp.expiresAt > Date.now();

  const startStepUpMutation = useMutation({
    mutationFn: () => superAdminApi.startLabsStepUp(),
    onSuccess: (res) => {
      setChallengeToken(res.challengeToken);
      setOtp('');
      setSqlError(null);
      setMessage('Verification code sent to your email');
    },
    onError: (err: Error) => setSqlError(err.message),
  });

  const verifyStepUpMutation = useMutation({
    mutationFn: () => superAdminApi.verifyLabsStepUp(challengeToken!, otp.trim()),
    onSuccess: (res) => {
      setStepUp({ token: res.stepUpToken, expiresAt: Date.now() + res.expiresInSeconds * 1000 });
      setChallengeToken(null);
      setOtp('');
      setSqlError(null);
      setMessage('Labs SQL unlocked for 10 minutes');
    },
    onError: (err: Error) => setSqlError(err.message),
  });

  const orgsQuery = useQuery({
    queryKey: ['super-admin', 'organizations', 'labs'],
    queryFn: () => superAdminApi.listOrganizations(1, 100),
  });

  const auditsQuery = useQuery({
    queryKey: ['super-admin', 'labs', 'sql-audits'],
    queryFn: () => superAdminApi.listLabsSqlAudits(50),
  });

  const filtered = useMemo(() => {
    const list = orgsQuery.data?.data ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((t) => {
      if (envFilter !== 'all' && String(t.environmentClass ?? 1) !== envFilter) {
        return false;
      }
      if (!needle) return true;
      return (
        t.name.toLowerCase().includes(needle) ||
        t.slug.toLowerCase().includes(needle) ||
        (t.email ?? '').toLowerCase().includes(needle)
      );
    });
  }, [orgsQuery.data, q, envFilter]);

  const envMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      environmentClass: number;
      sandboxSkipEmailOtp?: boolean;
      sandboxSkipSmsOtp?: boolean;
      sandboxRelaxPassword?: boolean;
    }) => {
      const { id, ...body } = payload;
      return superAdminApi.updateOrganizationEnvironment(id, body);
    },
    onSuccess: () => {
      setMessage('Tenant environment updated');
      setEnvChange(null);
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const sqlMutation = useMutation({
    mutationFn: () => superAdminApi.runLabsSql(sql, stepUp?.token ?? ''),
    onSuccess: (result) => {
      setSqlError(null);
      setSqlResult(result);
      auditsQuery.refetch();
    },
    onError: (err: Error) => {
      setSqlResult(null);
      if (err instanceof ApiRequestError && err.code === 'STEP_UP_REQUIRED') {
        setStepUp(null);
      }
      setSqlError(err.message);
      auditsQuery.refetch();
    },
  });

  function applyEnvChange() {
    if (!envChange) return;
    const { tenant, nextClass } = envChange;
    envMutation.mutate({
      id: tenant.id,
      environmentClass: nextClass,
      ...(nextClass === 0
        ? {
            sandboxSkipEmailOtp: true,
            sandboxSkipSmsOtp: true,
            sandboxRelaxPassword: true,
          }
        : {}),
    });
  }

  function toggleFlag(tenant: Tenant, key: 'sandboxSkipEmailOtp' | 'sandboxSkipSmsOtp' | 'sandboxRelaxPassword', value: boolean) {
    envMutation.mutate({
      id: tenant.id,
      environmentClass: 0,
      [key]: value,
    });
  }

  const sandboxCount = (orgsQuery.data?.data ?? []).filter((t) => t.environmentClass === 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant labs"
        description="Curated Sandbox / Live controls and a SELECT-only SQL console. Every SQL attempt is audited."
      />

      {message ? (
        <Notice tone="info">
          <span className="flex flex-wrap items-center justify-between gap-2">
            {message}
            <button type="button" className="text-xs font-medium underline" onClick={() => setMessage(null)}>
              Dismiss
            </button>
          </span>
        </Notice>
      ) : null}

      <PageTabs
        label="Labs sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'environments', label: 'Environments', count: sandboxCount || null },
          { id: 'sql', label: 'SQL console' },
          { id: 'audits', label: 'Audit trail', count: auditsQuery.data?.length ?? null },
        ]}
      />

      {tab === 'environments' ? (
        <DataTable
          rows={filtered}
          loading={orgsQuery.isLoading}
          getRowKey={(t) => t.id}
          emptyMessage="No tenants match"
          toolbar={
            <>
              <SearchInput label="Filter tenants" placeholder="Filter by name, slug, email…" value={q} onChange={setQ} />
              <FilterSelect
                aria-label="Environment"
                value={envFilter}
                onChange={(e) => setEnvFilter(e.target.value as 'all' | '0' | '1')}
                options={[
                  { value: 'all', label: 'All environments' },
                  { value: '0', label: 'Sandbox' },
                  { value: '1', label: 'Live' },
                ]}
              />
            </>
          }
          columns={[
            {
              key: 'tenant',
              header: 'Tenant',
              cell: (t) => (
                <div>
                  <Link to={`/tenants/${t.id}`} className="font-medium hover:text-accent">
                    {t.name}
                  </Link>
                  <p className="text-xs text-text-muted">{t.slug}</p>
                </div>
              ),
            },
            { key: 'status', header: 'Status', cell: (t) => (t.status ? <StatusPill status={t.status} /> : '—') },
            { key: 'env', header: 'Environment', cell: (t) => <EnvPill environmentClass={t.environmentClass} /> },
            {
              key: 'flags',
              header: 'Sandbox flags',
              cell: (t) =>
                t.environmentClass === 0 ? (
                  <div className="flex flex-col gap-1 text-xs">
                    {(
                      [
                        ['sandboxSkipEmailOtp', 'Skip email MFA'],
                        ['sandboxSkipSmsOtp', 'Skip SMS OTP'],
                        ['sandboxRelaxPassword', 'Relax password'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="accent-accent"
                          checked={t[key] !== false}
                          disabled={envMutation.isPending}
                          onChange={(e) => toggleFlag(t, key, e.target.checked)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-text-muted">N/A on Live</span>
                ),
            },
            {
              key: 'actions',
              header: <span className="sr-only">Actions</span>,
              className: 'text-right',
              cell: (t) =>
                t.environmentClass === 0 ? (
                  <Button size="sm" variant="secondary" disabled={envMutation.isPending} onClick={() => setEnvChange({ tenant: t, nextClass: 1 })}>
                    Promote to Live
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="text-status-warning" disabled={envMutation.isPending} onClick={() => setEnvChange({ tenant: t, nextClass: 0 })}>
                    Move to Sandbox
                  </Button>
                ),
            },
          ]}
        />
      ) : null}

      {tab === 'sql' ? (
        <div className="space-y-6">
          <SectionCard
            title="SQL console (SELECT only)"
            description="Max 200 rows, ~5s timeout, read-only transaction. Multi-statement and DML/DDL are rejected server-side. Requires an emailed verification code every 10 minutes."
            actions={
              stepUpActive ? (
                <StatusPill status="unlocked" tone="success" label="Unlocked" />
              ) : (
                <StatusPill status="locked" tone="warning" label="Locked" />
              )
            }
          >
            <div className="space-y-4">
              {!stepUpActive ? (
                <div className="flex flex-wrap items-end gap-3 rounded-xl border border-status-warning/30 bg-status-warning/5 p-4">
                  <Lock size={18} className="mb-2 text-status-warning" aria-hidden="true" />
                  {challengeToken ? (
                    <>
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-text-secondary">Verification code</span>
                        <input
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          className={`${inputClass} block w-32 font-mono tracking-widest`}
                        />
                      </label>
                      <Button size="sm" loading={verifyStepUpMutation.isPending} disabled={otp.length !== 6} onClick={() => verifyStepUpMutation.mutate()}>
                        <ShieldCheck size={16} aria-hidden="true" />
                        Verify
                      </Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="secondary" loading={startStepUpMutation.isPending} onClick={() => startStepUpMutation.mutate()}>
                    {challengeToken ? 'Resend code' : 'Email me a code to unlock'}
                  </Button>
                </div>
              ) : null}
              <textarea
                aria-label="SQL query"
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                rows={7}
                spellCheck={false}
                className={`${inputClass} font-mono`}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={sqlMutation.isPending} disabled={!sql.trim() || !stepUpActive} onClick={() => sqlMutation.mutate()}>
                  <Play size={16} aria-hidden="true" />
                  Run query
                </Button>
                {sqlResult ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(rowsToCsv(sqlResult.columns, sqlResult.rows));
                      setMessage('CSV copied to clipboard');
                    }}
                  >
                    <Copy size={16} aria-hidden="true" />
                    Copy CSV
                  </Button>
                ) : null}
              </div>
              {sqlError ? <Notice tone="error">{sqlError}</Notice> : null}
            </div>
          </SectionCard>

          {sqlResult ? (
            <SectionCard
              title="Results"
              description={`${sqlResult.rows.length} row(s) in ${sqlResult.durationMs}ms${sqlResult.truncated ? ' (truncated at 200)' : ''}`}
              flush
            >
              <div className="max-h-[28rem] overflow-auto sa-scroll">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-line-subtle bg-bg-secondary text-text-muted">
                    <tr>
                      {sqlResult.columns.map((c) => (
                        <th key={c} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sqlResult.rows.map((row, i) => (
                      <tr key={i} className="border-b border-line-subtle last:border-0 hover:bg-hover">
                        {sqlResult.columns.map((c) => (
                          <td key={c} className="max-w-xs truncate px-3 py-1.5 font-mono" title={cellText(row[c])}>
                            {cellText(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}
        </div>
      ) : null}

      {tab === 'audits' ? (
        <DataTable
          rows={auditsQuery.data ?? []}
          loading={auditsQuery.isLoading}
          getRowKey={(a) => a.id}
          emptyMessage="No SQL audits yet"
          columns={[
            {
              key: 'when',
              header: 'When',
              className: 'whitespace-nowrap text-text-secondary',
              cell: (a) => new Date(a.createdAt).toLocaleString(),
            },
            { key: 'actor', header: 'Actor', cell: (a) => a.actorEmail },
            {
              key: 'result',
              header: 'Result',
              cell: (a) =>
                a.success ? (
                  <span className="inline-flex items-center gap-2">
                    <StatusPill status="ok" tone="success" label="OK" />
                    <span className="text-xs text-text-muted">
                      {a.rowCount ?? 0} rows · {a.durationMs ?? '—'}ms
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-status-error">{a.error ?? 'failed'}</span>
                ),
            },
            {
              key: 'sql',
              header: 'SQL',
              cell: (a) => (
                <span className="block max-w-md truncate font-mono text-xs" title={a.sqlPreview}>
                  {a.sqlPreview}
                </span>
              ),
            },
          ]}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(envChange)}
        onClose={() => setEnvChange(null)}
        onConfirm={applyEnvChange}
        loading={envMutation.isPending}
        tone={envChange?.nextClass === 0 ? 'danger' : 'primary'}
        title={
          envChange
            ? `Move ${envChange.tenant.name} to ${envChange.nextClass === 0 ? 'Sandbox' : 'Live'}?`
            : ''
        }
        description={
          envChange?.nextClass === 0
            ? 'Sandbox can skip email MFA and SMS OTP when the Skip OTP toggles are on (default), and can relax passwords.'
            : 'Live tenants always enforce normal OTP and password rules.'
        }
        confirmLabel={envChange?.nextClass === 0 ? 'Move to Sandbox' : 'Promote to Live'}
      />
    </div>
  );
}
