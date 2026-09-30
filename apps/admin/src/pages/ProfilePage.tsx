import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, CardHeader, Input, PageShell, useToast } from '@cullinos/ui';
import { ImageUploadField } from '@/components/ImageUploadField';
import { UserAvatar } from '@/components/layout/UserMenu';
import { profileApi, type UserProfile } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const updateUser = useAuthStore((s) => s.updateUser);
  const impersonation = useAuthStore((s) => s.impersonation);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: profileApi.get });
  const profile = profileQuery.data;

  function applyProfile(next: UserProfile) {
    queryClient.setQueryData(['profile'], next);
    updateUser({ ...splitName(next.name), phone: next.phone, avatarUrl: next.avatarUrl });
  }

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setPhone(profile.phone ?? '');
    updateUser({ ...splitName(profile.name), phone: profile.phone, avatarUrl: profile.avatarUrl });
  }, [profile, updateUser]);

  const saveMutation = useMutation({
    mutationFn: () => profileApi.update({ name: name.trim(), phone: phone.trim() || null }),
    onSuccess: (next) => {
      applyProfile(next);
      toast.success('Profile saved.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeAvatarMutation = useMutation({
    mutationFn: profileApi.removeAvatar,
    onSuccess: (next) => {
      applyProfile(next);
      toast.success('Profile photo removed.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (profileQuery.isLoading) {
    return <p className="text-sm text-text-muted">Loading profile…</p>;
  }
  if (profileQuery.isError || !profile) {
    return <p className="text-sm text-status-error">Could not load your profile.</p>;
  }

  const dirty = name.trim() !== profile.name || (phone.trim() || null) !== (profile.phone ?? null);

  return (
    <PageShell title="My profile" description="How you appear to your team across Cullinos.">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar name={profile.name} avatarUrl={profile.avatarUrl} size={72} />
          <div className="min-w-0">
            <p className="text-lg font-semibold">{profile.name}</p>
            <p className="text-sm text-text-secondary">{profile.email}</p>
            <p className="text-xs text-text-muted">
              {profile.organizationName}
              {profile.roles.length ? ` · ${profile.roles.join(', ')}` : ''}
            </p>
          </div>
        </div>
        {impersonation ? (
          <p className="mt-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-sm">
            You are in a support session. Profile changes are disabled.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Details" />
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                toast.error('Name is required.');
                return;
              }
              saveMutation.mutate();
            }}
          >
            <Input
              label="Full name"
              required
              maxLength={120}
              value={name}
              disabled={impersonation}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Mobile number"
              type="tel"
              placeholder="+91 98765 43210"
              maxLength={20}
              value={phone}
              disabled={impersonation}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input label="Email" value={profile.email} disabled readOnly />
            <p className="text-xs text-text-muted">
              Your email is your sign-in ID. Ask an owner to change it from Staff.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={saveMutation.isPending} disabled={impersonation || !dirty}>
                Save changes
              </Button>
              {!impersonation ? (
                <Link to="/change-password" className="text-sm text-brand-primary hover:underline">
                  Change password
                </Link>
              ) : null}
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Profile photo" />
          <ImageUploadField
            slot="avatar"
            bare
            value={profile.avatarUrl ?? ''}
            disabled={impersonation || removeAvatarMutation.isPending}
            uploadLabel={profile.avatarUrl ? 'Change photo' : 'Upload photo'}
            onUpload={async (file) => {
              const next = await profileApi.uploadAvatar(file);
              applyProfile(next);
              toast.success('Profile photo updated.');
              return next.avatarUrl ?? '';
            }}
            onChange={(url) => {
              if (!url && profile.avatarUrl) removeAvatarMutation.mutate();
            }}
          />
          {profile.lastLoginAt ? (
            <p className="mt-4 text-xs text-text-muted">
              Last sign-in {new Date(profile.lastLoginAt).toLocaleString()}
            </p>
          ) : null}
        </Card>
      </div>
    </PageShell>
  );
}
