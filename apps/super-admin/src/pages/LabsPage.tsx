import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { type Tenant, superAdminApi } from '@/lib/api';

function EnvBadge({ environmentClass }: { environmentClass?: number }) {
  const sandbox = environmentClass === 0;
  return (
    <span
      className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
        sandbox
          ? 'border border-status-warning/40 bg-status-warning/10 text-status-warning'
          : 'border border-status-success/30 bg-status-success/10 text-status-success'
      }`}
    >
      {sandbox ? 'Sandbox' : 'Live'}
    </span>
  );
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

export function LabsPage() {
  const queryClient = useQueryClient();
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
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const sqlMutation = useMutation({
    mutationFn: () => superAdminApi.runLabsSql(sql),
    onSuccess: (result) => {
      setSqlError(null);
      setSqlResult(result);
      auditsQuery.refetch();
    },
    onError: (err: Error) => {
      setSqlResult(null);
      setSqlError(err.message);
      auditsQuery.refetch();
    },
  });

  function confirmEnvChange(tenant: Tenant, nextClass: number) {
    const from = tenant.environmentClass === 0 ? 'Sandbox' : 'Live';
    const to = nextClass === 0 ? 'Sandbox' : 'Live';
    if (from === to) return;
    const ok = window.confirm(
      `Change ${tenant.name} from ${from} to ${to}?${
        nextClass === 0
          ? '\n\nSandbox can skip email MFA, SMS OTP, and relax passwords.'
          : '\n\nLive tenants always enforce normal OTP and password rules.'
      }`,
    );
    if (!ok) return;
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

  function toggleFlag(
    tenant: Tenant,
    key: 'sandboxSkipEmailOtp' | 'sandboxSkipSmsOtp' | 'sandboxRelaxPassword',
    value: boolean,
  ) {
    envMutation.mutate({
      id: tenant.id,
      environmentClass: 0,
      [key]: value,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Tenant labs</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-secondary">
          Curated Sandbox / Live controls and a SELECT-only SQL console. Every SQL attempt is
          audited.
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm text-text-secondary">
          {message}
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Tenant environment</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Filter by name, slug, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-[16rem] flex-1 rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
          <select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value as 'all' | '0' | '1')}
            className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-brand-accent"
          >
            <option value="all">All environments</option>
            <option value="0">Sandbox</option>
            <option value="1">Live</option>
          </select>
        </div>

        {orgsQuery.isLoading ? (
          <p className="text-sm text-text-muted">Loading tenants…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/5 bg-bg-elevated text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Tenant</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Environment</th>
                  <th className="px-3 py-2 font-medium">Sandbox flags</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const sandbox = t.environmentClass === 0;
                  return (
                    <tr key={t.id} className="border-b border-white/5 align-top">
                      <td className="px-3 py-3">
                        <Link
                          to={`/tenants/${t.id}`}
                          className="font-medium text-brand-primary hover:underline"
                        >
                          {t.name}
                        </Link>
                        <div className="text-xs text-text-muted">{t.slug}</div>
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{t.status ?? '—'}</td>
                      <td className="px-3 py-3">
                        <EnvBadge environmentClass={t.environmentClass} />
                      </td>
                      <td className="px-3 py-3">
                        {sandbox ? (
                          <div className="flex flex-col gap-1 text-xs">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={t.sandboxSkipEmailOtp !== false}
                                disabled={envMutation.isPending}
                                onChange={(e) =>
                                  toggleFlag(t, 'sandboxSkipEmailOtp', e.target.checked)
                                }
                              />
                              Skip email MFA
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={t.sandboxSkipSmsOtp !== false}
                                disabled={envMutation.isPending}
                                onChange={(e) =>
                                  toggleFlag(t, 'sandboxSkipSmsOtp', e.target.checked)
                                }
                              />
                              Skip SMS OTP
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={t.sandboxRelaxPassword !== false}
                                disabled={envMutation.isPending}
                                onChange={(e) =>
                                  toggleFlag(t, 'sandboxRelaxPassword', e.target.checked)
                                }
                              />
                              Relax password
                            </label>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted">N/A on Live</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {sandbox ? (
                            <button
                              type="button"
                              disabled={envMutation.isPending}
                              onClick={() => confirmEnvChange(t, 1)}
                              className="rounded border border-white/10 px-2 py-1 text-xs hover:bg-white/5 disabled:opacity-60"
                            >
                              Promote to Live
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={envMutation.isPending}
                              onClick={() => confirmEnvChange(t, 0)}
                              className="rounded border border-status-warning/40 px-2 py-1 text-xs text-status-warning hover:bg-status-warning/10 disabled:opacity-60"
                            >
                              Move to Sandbox
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-text-muted">
                      No tenants match.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">SQL console (SELECT only)</h2>
        <p className="text-sm text-text-muted">
          Max 200 rows, ~5s timeout. Multi-statement and DML/DDL are rejected server-side.
        </p>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={6}
          spellCheck={false}
          className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 font-mono text-sm outline-none focus:border-brand-accent"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={sqlMutation.isPending || !sql.trim()}
            onClick={() => sqlMutation.mutate()}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-primary hover:opacity-90 disabled:opacity-60"
          >
            {sqlMutation.isPending ? 'Running…' : 'Run query'}
          </button>
          {sqlResult ? (
            <button
              type="button"
              onClick={() => {
                const csv = rowsToCsv(sqlResult.columns, sqlResult.rows);
                void navigator.clipboard.writeText(csv);
                setMessage('CSV copied to clipboard');
              }}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
            >
              Copy CSV
            </button>
          ) : null}
        </div>

        {sqlError ? (
          <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
            {sqlError}
          </div>
        ) : null}

        {sqlResult ? (
          <div className="space-y-2">
            <p className="text-xs text-text-muted">
              {sqlResult.rows.length} row(s) in {sqlResult.durationMs}ms
              {sqlResult.truncated ? ' (truncated at 200)' : ''}
            </p>
            <div className="max-h-[28rem] overflow-auto rounded-xl border border-white/5">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-white/5 bg-bg-elevated text-text-muted">
                  <tr>
                    {sqlResult.columns.map((c) => (
                      <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sqlResult.rows.map((row, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {sqlResult.columns.map((c) => (
                        <td key={c} className="max-w-xs truncate px-2 py-1 font-mono">
                          {row[c] == null
                            ? '∅'
                            : typeof row[c] === 'object'
                              ? JSON.stringify(row[c])
                              : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Recent SQL audits</h2>
        {auditsQuery.isLoading ? (
          <p className="text-sm text-text-muted">Loading audits…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-white/5 bg-bg-elevated text-text-muted">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">SQL</th>
                </tr>
              </thead>
              <tbody>
                {(auditsQuery.data ?? []).map((a) => (
                  <tr key={a.id} className="border-b border-white/5 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-text-muted">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{a.actorEmail}</td>
                    <td className="px-3 py-2">
                      {a.success ? (
                        <span className="text-status-success">
                          ok · {a.rowCount ?? 0} rows · {a.durationMs ?? '—'}ms
                        </span>
                      ) : (
                        <span className="text-status-error">{a.error ?? 'failed'}</span>
                      )}
                    </td>
                    <td className="max-w-md truncate px-3 py-2 font-mono">{a.sqlPreview}</td>
                  </tr>
                ))}
                {(auditsQuery.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-text-muted">
                      No audits yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
