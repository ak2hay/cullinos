import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, KeyRound, LogOut, Monitor } from 'lucide-react';
import { Button, Input } from '@cullinos/ui';
import { Card, PageHeader, SectionCard, StatusPill, useConfirm } from '@/components/ui';
import { MutationError, Notice } from '@/components/common';
import { ElevationDialog } from '@/components/governance/ElevationDialog';
import { UserAvatar } from '@/components/layout/UserMenu';
import { profileApi, type UserProfile } from '@/lib/api';
import { formatDateTime, securityApi } from '@/lib/platform-api';
import { PLATFORM_ROLE_LABELS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';

const MAX_AVATAR_MB = 5;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function ProfilePage() {
  const queryClient = useQueryClient();
  const admin = useAuthStore((s) => s.admin);
  const updateAdmin = useAuthStore((s) => s.updateAdmin);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: profileApi.get });
  const profile = profileQuery.data;

  function applyProfile(next: UserProfile) {
    queryClient.setQueryData(['profile'], next);
    updateAdmin({ name: next.name, avatarUrl: next.avatarUrl });
  }

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setPhone(profile.phone ?? '');
    updateAdmin({ name: profile.name, avatarUrl: profile.avatarUrl });
  }, [profile, updateAdmin]);

  const onError = (err: Error) => setMessage({ kind: 'error', text: err.message });

  const saveMutation = useMutation({
    mutationFn: () => profileApi.update({ name: name.trim(), phone: phone.trim() || null }),
    onSuccess: (next) => {
      applyProfile(next);
      setMessage({ kind: 'success', text: 'Profile saved.' });
    },
    onError,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(file),
    onSuccess: (next) => {
      applyProfile(next);
      setMessage({ kind: 'success', text: 'Profile photo updated.' });
    },
    onError,
    onSettled: () => {
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  const removeMutation = useMutation({
    mutationFn: profileApi.removeAvatar,
    onSuccess: (next) => {
      applyProfile(next);
      setMessage({ kind: 'success', text: 'Profile photo removed.' });
    },
    onError,
  });

  function handleFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    if (!ALLOWED_TYPES.has(file.type)) {
      setMessage({ kind: 'error', text: 'Use a PNG, JPG, or WebP image.' });
      return;
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setMessage({ kind: 'error', text: `Image must be ${MAX_AVATAR_MB} MB or smaller.` });
      return;
    }
    uploadMutation.mutate(file);
  }

  if (profileQuery.isLoading) {
    return <p className="text-sm text-text-muted">Loading profile…</p>;
  }
  if (profileQuery.isError || !profile) {
    return <Notice tone="error">Could not load your profile.</Notice>;
  }

  const dirty = name.trim() !== profile.name || (phone.trim() || null) !== (profile.phone ?? null);
  const busy = uploadMutation.isPending || removeMutation.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="My profile" description="How you appear to the platform team." breadcrumbs={false} />

      {message ? <Notice tone={message.kind === 'success' ? 'success' : 'error'}>{message.text}</Notice> : null}

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500" aria-hidden="true" />
        <div className="flex flex-wrap items-end gap-5 px-6 pb-6">
          <div className="-mt-10 rounded-full ring-4 ring-bg-card">
            <UserAvatar name={profile.name} avatarUrl={profile.avatarUrl} size={88} />
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <p className="font-display text-xl font-semibold">{profile.name}</p>
            <p className="text-sm text-text-secondary">{profile.email}</p>
            {admin?.platformRole ? (
              <StatusPill status="role" tone="brand" dot={false} label={PLATFORM_ROLE_LABELS[admin.platformRole]} />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-bg-card px-3 text-sm font-medium hover:bg-hover focus-within:ring-2 focus-within:ring-accent/30">
              <Camera size={16} aria-hidden="true" />
              {uploadMutation.isPending ? 'Uploading…' : profile.avatarUrl ? 'Change photo' : 'Upload photo'}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
            {profile.avatarUrl ? (
              <Button type="button" size="sm" variant="ghost" loading={removeMutation.isPending} disabled={busy} onClick={() => removeMutation.mutate()}>
                Remove
              </Button>
            ) : null}
          </div>
          <p className="basis-full text-xs text-text-muted">
            Square images work best (512×512). PNG, JPG, or WebP up to {MAX_AVATAR_MB} MB.
          </p>
        </div>
      </Card>

      <SectionCard title="Details" description="Your name and mobile number are visible to other platform staff.">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            if (!name.trim()) {
              setMessage({ kind: 'error', text: 'Name is required.' });
              return;
            }
            saveMutation.mutate();
          }}
        >
          <Input label="Full name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Mobile number"
            type="tel"
            maxLength={20}
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="sm:col-span-2">
            <Input label="Email" value={profile.email} disabled readOnly />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" loading={saveMutation.isPending} disabled={!dirty}>
              Save changes
            </Button>
            <Link to="/change-password" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              <KeyRound size={14} aria-hidden="true" />
              Change password
            </Link>
          </div>
        </form>
      </SectionCard>

      <AccessAndSessions />
    </div>
  );
}

function AccessAndSessions() {
  const qc = useQueryClient();
  const admin = useAuthStore((s) => s.admin);
  const [elevateOpen, setElevateOpen] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const sessions = useQuery({ queryKey: ['super-admin', 'my-sessions'], queryFn: securityApi.mySessions });
  const revoke = useMutation({
    mutationFn: (id: string) => securityApi.revokeSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'my-sessions'] }),
  });

  return (
    <SectionCard
      title="Access & sessions"
      description={
        admin?.employeeCode ? (
          <>
            Employee ID <span className="font-mono">{admin.employeeCode}</span> is recorded on every action you take.
          </>
        ) : (
          'Every action you take is recorded in the staff activity log.'
        )
      }
      actions={
        !admin?.isOwner ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setElevateOpen(true)}>
            Request temporary access
          </Button>
        ) : null
      }
    >
      {confirmDialog}
      <ul className="divide-y divide-line-subtle text-sm">
        {(sessions.data ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-secondary text-text-secondary">
                <Monitor size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate">{s.userAgent ?? 'Unknown device'}</p>
                <p className="text-xs text-text-muted">
                  Signed in {formatDateTime(s.createdAt)} · last used {formatDateTime(s.lastUsedAt)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-status-error"
              disabled={revoke.isPending}
              onClick={() =>
                void confirm({
                  title: 'Sign out this session?',
                  description: 'If it is this browser you will be logged out.',
                  confirmLabel: 'Sign out',
                }).then((ok) => ok && revoke.mutate(s.id))
              }
            >
              <LogOut size={14} aria-hidden="true" />
              Sign out
            </Button>
          </li>
        ))}
        {sessions.isLoading ? <li className="py-3 text-text-muted">Loading sessions…</li> : null}
        {sessions.data?.length === 0 ? <li className="py-3 text-text-muted">No active sessions.</li> : null}
      </ul>
      <MutationError error={revoke.error} />
      <ElevationDialog open={elevateOpen} onClose={() => setElevateOpen(false)} />
    </SectionCard>
  );
}
