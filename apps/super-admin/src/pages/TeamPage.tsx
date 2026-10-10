import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Power, RotateCcw, UserPlus } from 'lucide-react';
import { Button } from '@cullinos/ui';
import {
  ActionMenu,
  ConfirmDialog,
  DataTable,
  EntityAvatar,
  FilterSelect,
  FormDrawer,
  PageHeader,
  SearchInput,
  SectionCard,
  StatusPill,
} from '@/components/ui';
import { inputClass, LabeledInput, Notice } from '@/components/common';
import { StaffPicker } from '@/components/StaffPicker';
import { superAdminApi, type PlatformTeamMember, type TemporaryCredentials } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { PLATFORM_ROLE_LABELS, useCan, type PlatformRole } from '@/lib/permissions';
import { iamApi } from '@/lib/platform-api';
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

type InviteForm = {
  name: string;
  email: string;
  role: PlatformRole;
  title: string;
  departmentId: string;
  teamId: string;
  manager: { userId: string; label: string } | null;
};

const BLANK_INVITE: InviteForm = { name: '', email: '', role: 'support', title: '', departmentId: '', teamId: '', manager: null };

type Pending =
  | { kind: 'role'; member: PlatformTeamMember; role: PlatformRole }
  | { kind: 'reset'; member: PlatformTeamMember }
  | { kind: 'deactivate'; member: PlatformTeamMember };

export function TeamPage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.admin);
  const can = useCan();
  const canSeeOrg = can(['iam.read', 'directory.read']);
  const canOpenProfile = can('directory.read');
  const [invite, setInvite] = useState<InviteForm | null>(null);
  const [credentials, setCredentials] = useState<CredentialsNotice | null>(null);
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const teamQuery = useQuery({ queryKey: ['super-admin', 'team'], queryFn: superAdminApi.listTeam });
  const departmentsQuery = useQuery({
    queryKey: ['super-admin', 'iam', 'departments'],
    queryFn: iamApi.departments,
    enabled: Boolean(invite) && canSeeOrg,
  });
  const teamsQuery = useQuery({
    queryKey: ['super-admin', 'iam', 'teams'],
    queryFn: iamApi.teams,
    enabled: Boolean(invite) && canSeeOrg,
  });
  const teamOptions = (teamsQuery.data ?? []).filter((t) => !invite?.departmentId || t.departmentId === invite.departmentId);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'team'] });
  const showCredentials = (c: CredentialsNotice) => {
    setCredentials(c);
    setPasswordRevealed(false);
  };

  const inviteMutation = useMutation({
    mutationFn: (f: InviteForm) =>
      superAdminApi.inviteTeamMember({
        name: f.name.trim(),
        email: f.email.trim(),
        platformRole: f.role,
        title: f.title.trim() || undefined,
        departmentId: f.departmentId || undefined,
        teamId: f.teamId || undefined,
        managerUserId: f.manager?.userId,
      }),
    onSuccess: (res) => {
      showCredentials({ ...res, email: res.member.email, title: 'Team member invited' });
      setInvite(null);
      invalidate();
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: PlatformRole }) => superAdminApi.changeTeamMemberRole(id, role),
    onSuccess: (member) => {
      setMessage(`${member.name} is now ${PLATFORM_ROLE_LABELS[member.platformRole]}. They were signed out so the new access applies.`);
      setPending(null);
      invalidate();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => superAdminApi.deactivateTeamMember(id, reason),
    onSuccess: (member) => {
      setMessage(`${member.name} was deactivated and signed out.`);
      setPending(null);
      invalidate();
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.activateTeamMember(id),
    onSuccess: (member) => {
      setMessage(`${member.name} can sign in again.`);
      invalidate();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.resetTeamMemberPassword(id),
    onSuccess: (res) => {
      showCredentials({ ...res, title: 'Password reset' });
      setPending(null);
      invalidate();
    },
  });

  function openPending(next: Pending) {
    roleMutation.reset();
    resetMutation.reset();
    deactivateMutation.reset();
    setReason('');
    setPending(next);
  }

  function confirmPending() {
    if (!pending) return;
    if (pending.kind === 'role') roleMutation.mutate({ id: pending.member.id, role: pending.role });
    if (pending.kind === 'reset') resetMutation.mutate(pending.member.id);
    if (pending.kind === 'deactivate') deactivateMutation.mutate({ id: pending.member.id, reason: reason.trim() || undefined });
  }

  const q = search.trim().toLowerCase();
  const members = (teamQuery.data ?? []).filter(
    (m) =>
      (!roleFilter || m.platformRole === roleFilter) &&
      (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.employeeCode ?? '').toLowerCase().includes(q)),
  );

  const pendingCopy = pending
    ? pending.kind === 'role'
      ? {
          title: `Change ${pending.member.name}'s role?`,
          description: `From ${PLATFORM_ROLE_LABELS[pending.member.platformRole]} to ${PLATFORM_ROLE_LABELS[pending.role]}. They will be signed out.`,
          confirmLabel: 'Change role',
          tone: 'primary' as const,
          loading: roleMutation.isPending,
          error: roleMutation.error,
        }
      : pending.kind === 'reset'
        ? {
            title: `Reset ${pending.member.name}'s password?`,
            description: 'They will be signed out and must set a new password on next sign-in.',
            confirmLabel: 'Reset password',
            tone: 'danger' as const,
            loading: resetMutation.isPending,
            error: resetMutation.error,
          }
        : {
            title: `Deactivate ${pending.member.name}?`,
            description: 'They will be signed out immediately and cannot sign in until reactivated.',
            confirmLabel: 'Deactivate',
            tone: 'danger' as const,
            loading: deactivateMutation.isPending,
            error: deactivateMutation.error,
          }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform team"
        description="Rkyves employees who can sign in here. Each role only sees the sections it needs."
        actions={
          <Button
            size="sm"
            onClick={() => {
              inviteMutation.reset();
              setInvite(BLANK_INVITE);
            }}
          >
            <UserPlus size={16} aria-hidden="true" />
            Invite team member
          </Button>
        }
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

      {credentials ? (
        <Notice tone="success">
          <p className="font-medium">{credentials.title}</p>
          <p className="mt-1 text-text-secondary">
            {credentials.emailSent ? 'Login details were emailed. ' : 'Email was not sent (check SMTP settings); share these details securely. '}
            They must change the password on first sign-in.
          </p>
          <dl className="mt-3 grid gap-1 font-mono text-xs text-text-primary">
            <div>
              <dt className="inline text-text-muted">Email: </dt>
              <dd className="inline">{credentials.email}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-text-muted">Temp password:</dt>
              <dd>{passwordRevealed ? credentials.temporaryPassword : '•'.repeat(Math.max(12, credentials.temporaryPassword.length))}</dd>
              <button
                type="button"
                onClick={() => setPasswordRevealed((v) => !v)}
                className="rounded-md border border-line px-2 py-0.5 font-sans text-[11px] hover:bg-hover"
              >
                {passwordRevealed ? 'Hide' : 'Reveal once'}
              </button>
            </div>
            <div>
              <dt className="inline text-text-muted">Login: </dt>
              <dd className="inline">{credentials.loginUrl}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => {
              setCredentials(null);
              setPasswordRevealed(false);
            }}
            className="mt-3 text-xs font-medium text-text-muted hover:underline"
          >
            Dismiss
          </button>
        </Notice>
      ) : null}

      {teamQuery.error ? <Notice tone="error">{teamQuery.error instanceof Error ? teamQuery.error.message : 'Failed to load team'}</Notice> : null}

      <DataTable
        rows={members}
        loading={teamQuery.isLoading}
        getRowKey={(m) => m.id}
        emptyMessage={q || roleFilter ? 'No team members match these filters' : 'No team members yet'}
        toolbar={
          <>
            <SearchInput label="Search team" placeholder="Search name, email, ID…" value={search} onChange={setSearch} />
            <FilterSelect
              aria-label="Role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[{ value: '', label: 'All roles' }, ...ROLE_ORDER.map((r) => ({ value: r, label: PLATFORM_ROLE_LABELS[r] }))]}
            />
          </>
        }
        columns={[
          {
            key: 'name',
            header: 'Member',
            cell: (member) => {
              const isMe = member.id === me?.id;
              return (
                <div className="flex items-center gap-3">
                  <EntityAvatar name={member.name} size={36} rounded="full" />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {canOpenProfile ? (
                        <Link to={`/people/${member.id}`} className="hover:text-accent">
                          {member.name}
                        </Link>
                      ) : (
                        member.name
                      )}
                      {member.employeeCode ? <span className="ml-2 font-mono text-xs text-text-muted">{member.employeeCode}</span> : null}
                      {isMe ? <span className="ml-2 text-xs text-text-muted">(you)</span> : null}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {[member.email, member.title, member.team?.name ?? member.department?.name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              );
            },
          },
          {
            key: 'role',
            header: 'Role',
            cell: (member) => (
              <FilterSelect
                aria-label={`Role for ${member.name}`}
                value={member.platformRole}
                disabled={member.id === me?.id || roleMutation.isPending}
                onChange={(e) => {
                  const role = e.target.value as PlatformRole;
                  if (role !== member.platformRole) openPending({ kind: 'role', member, role });
                }}
                options={ROLE_ORDER.map((role) => ({ value: role, label: PLATFORM_ROLE_LABELS[role] }))}
              />
            ),
          },
          {
            key: 'status',
            header: 'Status',
            cell: (member) => {
              const inactive = member.status !== 'active';
              return (
                <div>
                  <StatusPill status={inactive ? 'inactive' : 'active'} />
                  {member.mustChangePassword && !inactive ? <p className="mt-1 text-xs text-text-muted">Pending first sign-in</p> : null}
                </div>
              );
            },
          },
          {
            key: 'login',
            header: 'Last login',
            className: 'text-text-secondary',
            cell: (member) =>
              member.lastLoginAt ? <span title={new Date(member.lastLoginAt).toLocaleString()}>{relativeTime(member.lastLoginAt)}</span> : 'Never',
          },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            className: 'w-12 text-right',
            cell: (member) => {
              if (member.id === me?.id) return null;
              const inactive = member.status !== 'active';
              return (
                <ActionMenu
                  actions={[
                    { label: 'Reset password', icon: KeyRound, disabled: inactive, onSelect: () => openPending({ kind: 'reset', member }) },
                    { label: 'Reactivate', icon: RotateCcw, hidden: !inactive, onSelect: () => activateMutation.mutate(member.id) },
                    { label: 'Deactivate', icon: Power, danger: true, hidden: inactive, onSelect: () => openPending({ kind: 'deactivate', member }) },
                  ]}
                />
              );
            },
          },
        ]}
      />

      <SectionCard title="What each role can do">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_ORDER.map((role) => (
            <div key={role} className="rounded-lg border border-line-subtle p-3">
              <dt className="font-medium">{PLATFORM_ROLE_LABELS[role]}</dt>
              <dd className="mt-1 text-text-secondary">{ROLE_SUMMARY[role]}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      {pendingCopy ? (
        <ConfirmDialog
          open
          onClose={() => setPending(null)}
          onConfirm={confirmPending}
          title={pendingCopy.title}
          description={pendingCopy.description}
          confirmLabel={pendingCopy.confirmLabel}
          tone={pendingCopy.tone}
          loading={pendingCopy.loading}
          error={pendingCopy.error}
        >
          {pending?.kind === 'deactivate' ? (
            <LabeledInput label="Reason (optional)" hint="Recorded in the audit log.">
              <textarea className={`${inputClass} min-h-20`} value={reason} onChange={(e) => setReason(e.target.value)} />
            </LabeledInput>
          ) : null}
        </ConfirmDialog>
      ) : null}

      <FormDrawer
        open={Boolean(invite)}
        onClose={() => setInvite(null)}
        title="Invite team member"
        description="Use their Rkyves work email. A temporary password is emailed and must be changed on first sign-in."
        submitLabel="Send invite"
        loading={inviteMutation.isPending}
        error={inviteMutation.error}
        submitDisabled={!invite || invite.name.trim().length < 2 || !invite.email.trim()}
        onSubmit={() => invite && inviteMutation.mutate(invite)}
      >
        {invite ? (
          <div className="space-y-4">
            <LabeledInput label="Full name">
              <input required minLength={2} className={inputClass} value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Work email">
              <input type="email" required className={inputClass} value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Role" hint={`${ROLE_SUMMARY[invite.role]} Add custom roles later under Role assignments.`}>
              <select className={inputClass} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as PlatformRole })}>
                {ROLE_ORDER.map((role) => (
                  <option key={role} value={role}>
                    {PLATFORM_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </LabeledInput>
            <LabeledInput label="Job title (optional)">
              <input className={inputClass} value={invite.title} onChange={(e) => setInvite({ ...invite, title: e.target.value })} />
            </LabeledInput>
            {canSeeOrg ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <LabeledInput label="Department">
                  <select
                    className={inputClass}
                    value={invite.departmentId}
                    onChange={(e) => setInvite({ ...invite, departmentId: e.target.value, teamId: '' })}
                  >
                    <option value="">—</option>
                    {(departmentsQuery.data ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </LabeledInput>
                <LabeledInput label="Team">
                  <select
                    className={inputClass}
                    value={invite.teamId}
                    onChange={(e) => {
                      const team = teamOptions.find((t) => t.id === e.target.value);
                      setInvite({ ...invite, teamId: e.target.value, departmentId: team ? team.departmentId : invite.departmentId });
                    }}
                  >
                    <option value="">—</option>
                    {teamOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </LabeledInput>
              </div>
            ) : null}
            {canOpenProfile ? (
              <LabeledInput label="Reports to (optional)">
                <StaffPicker value={invite.manager} onChange={(manager) => setInvite({ ...invite, manager })} />
              </LabeledInput>
            ) : null}
          </div>
        ) : null}
      </FormDrawer>
    </div>
  );
}
