import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Copy, KeyRound, LogOut, Mail, Pencil, Power, RotateCcw, Trash2, UserMinus, UserPlus } from 'lucide-react';
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
import { peopleApi, securityApi } from '@/lib/platform-api';
import { useAuthStore } from '@/stores/auth';
import { OnboardEmployeeDialog } from './OnboardEmployeeDialog';
import { ROLE_ORDER, ROLE_SUMMARY } from './roles';

type CredentialsNotice = TemporaryCredentials & { email: string; title: string };

type EditForm = { member: PlatformTeamMember; name: string; email: string; phone: string };

type Pending =
  | { kind: 'role'; member: PlatformTeamMember; role: PlatformRole }
  | { kind: 'reset'; member: PlatformTeamMember }
  | { kind: 'resend'; member: PlatformTeamMember }
  | { kind: 'deactivate'; member: PlatformTeamMember }
  | { kind: 'sessions'; member: PlatformTeamMember }
  | { kind: 'offboard'; member: PlatformTeamMember }
  | { kind: 'delete'; member: PlatformTeamMember };

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending first sign-in' },
  { value: 'inactive', label: 'Deactivated' },
];

/** Cullinos (Rkyves) employees: onboard, edit, manage access and remove. */
export function EmployeesPage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.admin);
  const can = useCan();
  const canOpenProfile = can('directory.read');
  const [searchParams, setSearchParams] = useSearchParams();
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [credentials, setCredentials] = useState<CredentialsNotice | null>(null);
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [handOver, setHandOver] = useState<{ userId: string; label: string } | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (searchParams.get('onboard') === '1') {
      setOnboardOpen(true);
      searchParams.delete('onboard');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const teamQuery = useQuery({ queryKey: ['super-admin', 'team'], queryFn: superAdminApi.listTeam });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'team'] });
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'people'] });
  };
  const showCredentials = (c: CredentialsNotice) => {
    setCredentials(c);
    setPasswordRevealed(false);
    setCopied(false);
  };
  const done = (text: string) => {
    setMessage(text);
    setPending(null);
    invalidate();
  };

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: PlatformRole }) => superAdminApi.changeTeamMemberRole(id, role),
    onSuccess: (m) => done(`${m.name} is now ${PLATFORM_ROLE_LABELS[m.platformRole]}. They were signed out so the new access applies.`),
  });
  const deactivateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => superAdminApi.deactivateTeamMember(id, reason),
    onSuccess: (m) => done(`${m.name} was deactivated and signed out.`),
  });
  const activateMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.activateTeamMember(id),
    onSuccess: (m) => done(`${m.name} can sign in again.`),
    onError: (err: Error) => setMessage(err.message),
  });
  const credentialMutation = useMutation({
    mutationFn: ({ id, invite }: { id: string; invite: boolean }) =>
      invite ? superAdminApi.resendTeamInvite(id) : superAdminApi.resetTeamMemberPassword(id),
    onSuccess: (res, vars) => {
      showCredentials({ ...res, title: vars.invite ? 'Invite re-sent' : 'Password reset' });
      setPending(null);
      invalidate();
    },
  });
  const sessionsMutation = useMutation({
    mutationFn: (id: string) => securityApi.revokeAllForUser(id),
    onSuccess: () => done(`${pending?.member.name ?? 'They'} were signed out of every device.`),
  });
  const offboardMutation = useMutation({
    mutationFn: ({ id, remove }: { id: string; remove: boolean }): Promise<{ transferredTickets: number }> => {
      const body = { reason: reason.trim() || undefined, transferToUserId: handOver?.userId ?? null };
      return remove ? peopleApi.remove(id, body) : peopleApi.offboard(id, body);
    },
    onSuccess: (res, vars) =>
      done(
        `${pending?.member.name ?? 'Employee'} was ${vars.remove ? 'removed from the team' : 'offboarded'}` +
          (res.transferredTickets ? `; ${res.transferredTickets} open ticket(s) handed over.` : '.'),
      ),
  });
  const editMutation = useMutation({
    mutationFn: (f: EditForm) =>
      superAdminApi.updateTeamMember(f.member.id, {
        name: f.name.trim(),
        email: f.email.trim().toLowerCase(),
        phone: f.phone.trim() || null,
      }),
    onSuccess: (m) => {
      setEdit(null);
      setMessage(`${m.name}'s details were saved.`);
      invalidate();
    },
  });

  function openPending(next: Pending) {
    for (const m of [roleMutation, credentialMutation, deactivateMutation, sessionsMutation, offboardMutation]) m.reset();
    setReason('');
    setHandOver(null);
    setPending(next);
  }

  function confirmPending() {
    if (!pending) return;
    const id = pending.member.id;
    if (pending.kind === 'role') roleMutation.mutate({ id, role: pending.role });
    if (pending.kind === 'reset') credentialMutation.mutate({ id, invite: false });
    if (pending.kind === 'resend') credentialMutation.mutate({ id, invite: true });
    if (pending.kind === 'deactivate') deactivateMutation.mutate({ id, reason: reason.trim() || undefined });
    if (pending.kind === 'sessions') sessionsMutation.mutate(id);
    if (pending.kind === 'offboard') offboardMutation.mutate({ id, remove: false });
    if (pending.kind === 'delete') offboardMutation.mutate({ id, remove: true });
  }

  const q = search.trim().toLowerCase();
  const members = (teamQuery.data ?? []).filter((m) => {
    const isPending = m.status === 'active' && m.mustChangePassword;
    if (roleFilter && m.platformRole !== roleFilter) return false;
    if (statusFilter === 'active' && (m.status !== 'active' || isPending)) return false;
    if (statusFilter === 'pending' && !isPending) return false;
    if (statusFilter === 'inactive' && m.status === 'active') return false;
    return (
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.phone ?? '').includes(q) ||
      (m.employeeCode ?? '').toLowerCase().includes(q)
    );
  });

  const pendingCopy = pending ? describePending(pending) : null;
  const pendingState =
    pending?.kind === 'role'
      ? roleMutation
      : pending?.kind === 'reset' || pending?.kind === 'resend'
        ? credentialMutation
        : pending?.kind === 'deactivate'
          ? deactivateMutation
          : pending?.kind === 'sessions'
            ? sessionsMutation
            : offboardMutation;

  async function copyCredentials() {
    if (!credentials) return;
    const text = `Sign-in: ${credentials.loginUrl}\nEmail: ${credentials.email}\nTemporary password: ${credentials.temporaryPassword}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Cullinos (Rkyves) employees who can sign in to the platform. Onboard, edit, manage access and remove people here."
        actions={
          <Button size="sm" onClick={() => setOnboardOpen(true)}>
            <UserPlus size={16} aria-hidden="true" />
            Onboard employee
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
        <Notice tone={credentials.emailSent ? 'success' : 'warning'}>
          <p className="font-medium">{credentials.title}</p>
          <p className="mt-1 text-text-secondary">
            {credentials.emailSent
              ? 'Sign-in details were emailed. If it does not arrive, share the details below securely. '
              : 'The email could not be sent (check mail settings). Share these sign-in details with them securely. '}
            They must change the password on first sign-in. This password is shown only now.
          </p>
          <dl className="mt-3 grid gap-1 font-mono text-xs text-text-primary">
            <div>
              <dt className="inline text-text-muted">Email (sign-in ID): </dt>
              <dd className="inline">{credentials.email}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-text-muted">Temporary password:</dt>
              <dd>{passwordRevealed ? credentials.temporaryPassword : '•'.repeat(Math.max(12, credentials.temporaryPassword.length))}</dd>
              <button
                type="button"
                onClick={() => setPasswordRevealed((v) => !v)}
                className="rounded-md border border-line px-2 py-0.5 font-sans text-[11px] hover:bg-hover"
              >
                {passwordRevealed ? 'Hide' : 'Reveal'}
              </button>
              <button
                type="button"
                onClick={() => void copyCredentials()}
                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 font-sans text-[11px] hover:bg-hover"
              >
                <Copy size={12} aria-hidden="true" />
                {copied ? 'Copied' : 'Copy sign-in details'}
              </button>
            </div>
            <div>
              <dt className="inline text-text-muted">Sign in at: </dt>
              <dd className="inline">{credentials.loginUrl}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => setCredentials(null)}
            className="mt-3 text-xs font-medium text-text-muted hover:underline"
          >
            Dismiss
          </button>
        </Notice>
      ) : null}

      {teamQuery.error ? (
        <Notice tone="error">{teamQuery.error instanceof Error ? teamQuery.error.message : 'Failed to load employees'}</Notice>
      ) : null}

      <DataTable
        rows={members}
        loading={teamQuery.isLoading}
        getRowKey={(m) => m.id}
        emptyMessage={q || roleFilter || statusFilter ? 'No employees match these filters' : 'No employees yet'}
        toolbar={
          <>
            <SearchInput label="Search employees" placeholder="Search name, email, phone, ID…" value={search} onChange={setSearch} />
            <FilterSelect
              aria-label="Role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[{ value: '', label: 'All roles' }, ...ROLE_ORDER.map((r) => ({ value: r, label: PLATFORM_ROLE_LABELS[r] }))]}
            />
            <FilterSelect aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={STATUS_OPTIONS} />
          </>
        }
        columns={[
          {
            key: 'name',
            header: 'Employee',
            cell: (member) => (
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
                    {member.id === me?.id ? <span className="ml-2 text-xs text-text-muted">(you)</span> : null}
                  </p>
                  <p className="truncate text-xs text-text-muted">{[member.email, member.phone, member.title].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'dept',
            header: 'Department / team',
            className: 'text-text-secondary',
            cell: (member) => [member.department?.name, member.team?.name].filter(Boolean).join(' / ') || '—',
          },
          {
            key: 'role',
            header: 'Role',
            cell: (member) => (
              <FilterSelect
                aria-label={`Role for ${member.name}`}
                value={member.platformRole}
                disabled={member.id === me?.id || roleMutation.isPending || member.status !== 'active'}
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
                    {
                      label: 'Edit details',
                      icon: Pencil,
                      onSelect: () => {
                        editMutation.reset();
                        setEdit({ member, name: member.name, email: member.email, phone: member.phone ?? '' });
                      },
                    },
                    {
                      label: 'Resend invite',
                      icon: Mail,
                      hidden: inactive || !member.mustChangePassword,
                      onSelect: () => openPending({ kind: 'resend', member }),
                    },
                    { label: 'Reset password', icon: KeyRound, hidden: inactive, onSelect: () => openPending({ kind: 'reset', member }) },
                    { label: 'Sign out everywhere', icon: LogOut, hidden: inactive, onSelect: () => openPending({ kind: 'sessions', member }) },
                    { label: 'Reactivate', icon: RotateCcw, hidden: !inactive, onSelect: () => activateMutation.mutate(member.id) },
                    { label: 'Deactivate', icon: Power, danger: true, hidden: inactive, onSelect: () => openPending({ kind: 'deactivate', member }) },
                    { label: 'Offboard', icon: UserMinus, danger: true, onSelect: () => openPending({ kind: 'offboard', member }) },
                    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => openPending({ kind: 'delete', member }) },
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

      {pending && pendingCopy ? (
        <ConfirmDialog
          open
          onClose={() => setPending(null)}
          onConfirm={confirmPending}
          title={pendingCopy.title}
          description={pendingCopy.description}
          confirmLabel={pendingCopy.confirmLabel}
          tone={pendingCopy.tone}
          loading={pendingState.isPending}
          error={pendingState.error}
          requireText={pending.kind === 'delete' ? 'DELETE' : undefined}
        >
          {pending.kind === 'deactivate' || pending.kind === 'offboard' || pending.kind === 'delete' ? (
            <div className="space-y-3">
              <LabeledInput label="Reason (optional)" hint="Recorded in the audit log.">
                <textarea className={`${inputClass} min-h-20`} value={reason} onChange={(e) => setReason(e.target.value)} />
              </LabeledInput>
              {pending.kind !== 'deactivate' ? (
                <LabeledInput label="Hand open tickets to (optional)">
                  <StaffPicker value={handOver} onChange={setHandOver} />
                </LabeledInput>
              ) : null}
            </div>
          ) : null}
        </ConfirmDialog>
      ) : null}

      <FormDrawer
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={edit ? `Edit ${edit.member.name}` : 'Edit employee'}
        description="Changing the email changes their sign-in ID and signs them out. Title, department, team and manager are on their profile."
        submitLabel="Save"
        loading={editMutation.isPending}
        error={editMutation.error}
        submitDisabled={!edit || edit.name.trim().length < 2 || !edit.email.trim()}
        onSubmit={() => edit && editMutation.mutate(edit)}
        extraFooter={
          edit && canOpenProfile ? (
            <Link to={`/people/${edit.member.id}`} className="text-sm text-accent hover:underline">
              Open full profile
            </Link>
          ) : undefined
        }
      >
        {edit ? (
          <div className="space-y-4">
            <LabeledInput label="Full name">
              <input required minLength={2} className={inputClass} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Work email (sign-in ID)">
              <input type="email" required className={inputClass} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Phone">
              <input type="tel" className={inputClass} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </LabeledInput>
          </div>
        ) : null}
      </FormDrawer>

      <OnboardEmployeeDialog
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onOnboarded={(res) => {
          setOnboardOpen(false);
          showCredentials({ ...res, email: res.member.email, title: `${res.member.name} was onboarded` });
          invalidate();
        }}
      />
    </div>
  );
}

function describePending(p: Pending): {
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
} {
  const name = p.member.name;
  switch (p.kind) {
    case 'role':
      return {
        title: `Change ${name}'s role?`,
        description: `From ${PLATFORM_ROLE_LABELS[p.member.platformRole]} to ${PLATFORM_ROLE_LABELS[p.role]}. They will be signed out.`,
        confirmLabel: 'Change role',
        tone: 'primary',
      };
    case 'resend':
      return {
        title: `Resend ${name}'s invite?`,
        description: 'A new temporary password is generated and emailed with the welcome message. The previous one stops working.',
        confirmLabel: 'Resend invite',
        tone: 'primary',
      };
    case 'reset':
      return {
        title: `Reset ${name}'s password?`,
        description: 'They will be signed out and must set a new password on next sign-in.',
        confirmLabel: 'Reset password',
        tone: 'danger',
      };
    case 'sessions':
      return {
        title: `Sign ${name} out everywhere?`,
        description: 'Every active session is ended. They can sign in again with their password.',
        confirmLabel: 'Sign out',
        tone: 'danger',
      };
    case 'deactivate':
      return {
        title: `Deactivate ${name}?`,
        description: 'They will be signed out immediately and cannot sign in until reactivated.',
        confirmLabel: 'Deactivate',
        tone: 'danger',
      };
    case 'offboard':
      return {
        title: `Offboard ${name}?`,
        description:
          'Same-day lockout: deactivates the account and revokes sessions, role grants and tenant access. They stay listed as deactivated.',
        confirmLabel: 'Offboard',
        tone: 'danger',
      };
    case 'delete':
      return {
        title: `Delete ${name}?`,
        description:
          'Offboards them and removes them from the employee list. Their audit history is kept. You can onboard the same email again later.',
        confirmLabel: 'Delete employee',
        tone: 'danger',
      };
  }
}
