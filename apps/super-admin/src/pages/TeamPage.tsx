import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { superAdminApi, type PlatformTeamMember, type TemporaryCredentials } from '@/lib/api';
import { PLATFORM_ROLE_LABELS, type PlatformRole } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';

const ROLE_ORDER: PlatformRole[] = ['owner', 'support', 'sales', 'marketing', 'finance', 'viewer'];

const ROLE_SUMMARY: Record<PlatformRole, string> = {
  owner: 'Everything, including team, settings, Labs SQL and tenant delete.',
  support: 'Tenants (read, suspend, open as tenant), tenant user resets, App Ops, audit.',
  sales: 'Tenants (read, onboard), subscriptions, plans (read), marketing inquiries.',
  marketing: 'Marketing CMS, inquiries, promo email, App Ops.',
  finance: 'Plans, subscriptions, tenant wallets, audit.',
  viewer: 'Read-only dashboard, tenants, plans, audit and health.',
};

type CredentialsNotice = TemporaryCredentials & { email: string; title: string };

export function TeamPage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.admin);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<PlatformRole>('support');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialsNotice | null>(null);
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const teamQuery = useQuery({
    queryKey: ['super-admin', 'team'],
    queryFn: superAdminApi.listTeam,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'team'] });
  const onError = (err: Error) => setMessage(err.message);

  const inviteMutation = useMutation({
    mutationFn: () =>
      superAdminApi.inviteTeamMember({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        platformRole: inviteRole,
      }),
    onSuccess: (res) => {
      setCredentials({ ...res, email: res.member.email, title: 'Team member invited' });
      setPasswordRevealed(false);
      setShowInvite(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('support');
      setInviteError(null);
      invalidate();
    },
    onError: (err: Error) => setInviteError(err.message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: PlatformRole }) =>
      superAdminApi.changeTeamMemberRole(id, role),
    onSuccess: (member) => {
      setMessage(
        `${member.name} is now ${PLATFORM_ROLE_LABELS[member.platformRole]}. They were signed out so the new access applies.`,
      );
      invalidate();
    },
    onError,
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      superAdminApi.deactivateTeamMember(id, reason),
    onSuccess: (member) => {
      setMessage(`${member.name} was deactivated and signed out.`);
      invalidate();
    },
    onError,
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.activateTeamMember(id),
    onSuccess: (member) => {
      setMessage(`${member.name} can sign in again.`);
      invalidate();
    },
    onError,
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.resetTeamMemberPassword(id),
    onSuccess: (res) => {
      setCredentials({ ...res, title: 'Password reset' });
      setPasswordRevealed(false);
      invalidate();
    },
    onError,
  });

  function handleDeactivate(member: PlatformTeamMember) {
    if (!window.confirm(`Deactivate ${member.name}? They will be signed out immediately.`)) return;
    const reason = window.prompt('Optional reason (recorded in the audit log):');
    if (reason === null) return;
    deactivateMutation.mutate({ id: member.id, reason: reason.trim() || undefined });
  }

  function handleRoleChange(member: PlatformTeamMember, role: PlatformRole) {
    if (role === member.platformRole) return;
    const ok = window.confirm(
      `Change ${member.name} from ${PLATFORM_ROLE_LABELS[member.platformRole]} to ${PLATFORM_ROLE_LABELS[role]}? They will be signed out.`,
    );
    if (ok) roleMutation.mutate({ id: member.id, role });
  }

  const members = teamQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Platform team</h1>
          <p className="mt-1 text-text-secondary">
            Rkyves employees who can sign in here. Each role only sees the sections it needs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowInvite(true);
            setInviteError(null);
          }}
          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-primary-dark"
        >
          Invite team member
        </button>
      </div>

      {message ? (
        <div className="rounded-xl border border-line bg-bg-card px-4 py-3 text-sm text-text-secondary">
          {message}
          <button type="button" className="ml-3 text-xs underline" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {credentials ? (
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-4 text-sm">
          <p className="font-medium text-status-success">{credentials.title}</p>
          <p className="mt-1 text-text-secondary">
            {credentials.emailSent
              ? 'Login details were emailed. '
              : 'Email was not sent (check SMTP settings); share these details securely. '}
            They must change the password on first sign-in.
          </p>
          <div className="mt-3 space-y-1 font-mono text-xs text-text-primary">
            <p>
              <span className="text-text-muted">Email: </span>
              {credentials.email}
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-text-muted">Temp password:</span>
              <span>
                {passwordRevealed
                  ? credentials.temporaryPassword
                  : '•'.repeat(Math.max(12, credentials.temporaryPassword.length))}
              </span>
              <button
                type="button"
                onClick={() => setPasswordRevealed((v) => !v)}
                className="rounded border border-line px-2 py-0.5 text-[11px] hover:bg-hover"
              >
                {passwordRevealed ? 'Hide' : 'Reveal once'}
              </button>
            </p>
            <p>
              <span className="text-text-muted">Login: </span>
              {credentials.loginUrl}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCredentials(null);
              setPasswordRevealed(false);
            }}
            className="mt-3 text-xs text-text-muted hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {teamQuery.error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {teamQuery.error instanceof Error ? teamQuery.error.message : 'Failed to load team'}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line-subtle bg-bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line-subtle bg-bg-secondary text-text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teamQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Loading team…
                </td>
              </tr>
            ) : (
              members.map((member) => {
                const isMe = member.id === me?.id;
                const inactive = member.status !== 'active';
                return (
                  <tr key={member.id} className="border-b border-line-subtle">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {member.name}
                        {isMe ? <span className="ml-2 text-xs text-text-muted">(you)</span> : null}
                      </p>
                      <p className="text-xs text-text-muted">{member.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={member.platformRole}
                        disabled={isMe || roleMutation.isPending}
                        onChange={(e) => handleRoleChange(member, e.target.value as PlatformRole)}
                        className="rounded-lg border border-line bg-bg-elevated px-2 py-1 text-sm outline-none focus:border-brand-accent disabled:opacity-60"
                      >
                        {ROLE_ORDER.map((role) => (
                          <option key={role} value={role}>
                            {PLATFORM_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          inactive
                            ? 'bg-status-error/15 text-status-error'
                            : 'bg-status-success/15 text-status-success'
                        }`}
                      >
                        {inactive ? 'Inactive' : 'Active'}
                      </span>
                      {member.mustChangePassword && !inactive ? (
                        <p className="mt-1 text-xs text-text-muted">Pending first sign-in</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      {isMe ? (
                        <span className="text-xs text-text-muted">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Reset ${member.name}'s password? They will be signed out.`,
                                )
                              ) {
                                resetMutation.mutate(member.id);
                              }
                            }}
                            disabled={resetMutation.isPending || inactive}
                            className="text-xs text-brand-primary hover:underline disabled:opacity-60"
                          >
                            Reset password
                          </button>
                          {inactive ? (
                            <button
                              type="button"
                              onClick={() => activateMutation.mutate(member.id)}
                              disabled={activateMutation.isPending}
                              className="text-xs text-status-success hover:underline disabled:opacity-60"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(member)}
                              disabled={deactivateMutation.isPending}
                              className="text-xs text-status-error hover:underline disabled:opacity-60"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-line-subtle bg-bg-card p-5">
        <h2 className="font-medium">What each role can do</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {ROLE_ORDER.map((role) => (
            <div key={role}>
              <dt className="font-medium">{PLATFORM_ROLE_LABELS[role]}</dt>
              <dd className="text-text-secondary">{ROLE_SUMMARY[role]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {showInvite ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
          <div className="w-full max-w-md rounded-xl border border-line bg-bg-secondary p-6">
            <h2 className="text-lg font-medium">Invite team member</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Use their Rkyves work email. A temporary password is emailed and must be changed on
              first sign-in.
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                inviteMutation.mutate();
              }}
            >
              <label className="block">
                <span className="text-sm text-text-secondary">Full name</span>
                <input
                  required
                  minLength={2}
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                />
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">Work email</span>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                />
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">Role</span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as PlatformRole)}
                  className="mt-1 w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
                >
                  {ROLE_ORDER.map((role) => (
                    <option key={role} value={role}>
                      {PLATFORM_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-text-muted">
                  {ROLE_SUMMARY[inviteRole]}
                </span>
              </label>
              {inviteError ? <p className="text-sm text-status-error">{inviteError}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="rounded-lg px-4 py-2 text-sm hover:bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
                >
                  {inviteMutation.isPending ? 'Inviting…' : 'Send invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
