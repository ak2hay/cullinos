import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '@cullinos/ui';
import { UserAvatar } from '@/components/layout/UserMenu';
import { profileApi, type UserProfile } from '@/lib/api';
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
    return <p className="text-sm text-status-error">Could not load your profile.</p>;
  }

  const dirty = name.trim() !== profile.name || (phone.trim() || null) !== (profile.phone ?? null);
  const busy = uploadMutation.isPending || removeMutation.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My profile</h1>
        <p className="mt-1 text-sm text-text-secondary">How you appear to the platform team.</p>
      </div>

      {message ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.kind === 'success'
              ? 'border-status-success/30 bg-status-success/10 text-status-success'
              : 'border-status-error/30 bg-status-error/10 text-status-error'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <section className="flex flex-wrap items-center gap-5 rounded-xl border border-line-subtle bg-bg-secondary p-5">
        <UserAvatar name={profile.name} avatarUrl={profile.avatarUrl} size={80} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{profile.name}</p>
          <p className="text-sm text-text-secondary">{profile.email}</p>
          {admin?.platformRole ? (
            <p className="text-xs text-brand-primary">{PLATFORM_ROLE_LABELS[admin.platformRole]}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm">
            {uploadMutation.isPending ? 'Uploading…' : profile.avatarUrl ? 'Change photo' : 'Upload photo'}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={busy}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          {profile.avatarUrl ? (
            <Button
              type="button"
              variant="ghost"
              loading={removeMutation.isPending}
              disabled={busy}
              onClick={() => removeMutation.mutate()}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <p className="basis-full text-xs text-text-muted">
          Square images work best (512×512). PNG, JPG, or WebP up to {MAX_AVATAR_MB} MB.
        </p>
      </section>

      <form
        className="space-y-4 rounded-xl border border-line-subtle bg-bg-secondary p-5"
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
        <h2 className="font-semibold">Details</h2>
        <Input
          label="Full name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Mobile number"
          type="tel"
          maxLength={20}
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input label="Email" value={profile.email} disabled readOnly />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saveMutation.isPending} disabled={!dirty}>
            Save changes
          </Button>
          <Link to="/change-password" className="text-sm text-brand-primary hover:underline">
            Change password
          </Link>
        </div>
      </form>
    </div>
  );
}
