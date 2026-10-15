import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FormDrawer } from '@/components/ui';
import { inputClass, LabeledInput } from '@/components/common';
import { StaffPicker } from '@/components/StaffPicker';
import { superAdminApi, type PlatformTeamMember, type TemporaryCredentials } from '@/lib/api';
import { PLATFORM_ROLE_LABELS, useCan, type PlatformRole } from '@/lib/permissions';
import { iamApi } from '@/lib/platform-api';
import { ROLE_ORDER, ROLE_SUMMARY } from './roles';

type OnboardForm = {
  name: string;
  email: string;
  phone: string;
  role: PlatformRole;
  title: string;
  departmentId: string;
  teamId: string;
  location: string;
  manager: { userId: string; label: string } | null;
};

const BLANK: OnboardForm = {
  name: '',
  email: '',
  phone: '',
  role: 'support',
  title: '',
  departmentId: '',
  teamId: '',
  location: '',
  manager: null,
};

export function OnboardEmployeeDialog({
  open,
  onClose,
  onOnboarded,
}: {
  open: boolean;
  onClose: () => void;
  onOnboarded: (res: TemporaryCredentials & { member: PlatformTeamMember }) => void;
}) {
  const can = useCan();
  const canSeeOrg = can(['iam.read', 'directory.read']);
  const canPickManager = can('directory.read');
  const [form, setForm] = useState<OnboardForm>(BLANK);

  const departmentsQuery = useQuery({
    queryKey: ['super-admin', 'iam', 'departments'],
    queryFn: iamApi.departments,
    enabled: open && canSeeOrg,
  });
  const teamsQuery = useQuery({
    queryKey: ['super-admin', 'iam', 'teams'],
    queryFn: iamApi.teams,
    enabled: open && canSeeOrg,
  });
  const teamOptions = (teamsQuery.data ?? []).filter((t) => !form.departmentId || t.departmentId === form.departmentId);

  const mutation = useMutation({
    mutationFn: async (f: OnboardForm) => {
      const res = await superAdminApi.inviteTeamMember({
        name: f.name.trim(),
        email: f.email.trim().toLowerCase(),
        platformRole: f.role,
        title: f.title.trim() || undefined,
        departmentId: f.departmentId || undefined,
        teamId: f.teamId || undefined,
        managerUserId: f.manager?.userId,
        location: f.location.trim() || undefined,
      });
      if (f.phone.trim()) {
        res.member = await superAdminApi.updateTeamMember(res.member.id, { phone: f.phone.trim() });
      }
      return res;
    },
    onSuccess: (res) => {
      setForm(BLANK);
      onOnboarded(res);
    },
  });

  const set = (patch: Partial<OnboardForm>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <FormDrawer
      open={open}
      onClose={() => {
        mutation.reset();
        onClose();
      }}
      title="Onboard employee"
      description="Creates their Cullinos platform account with a Rkyves work email. A temporary password is generated, emailed to them and shown to you once; they must change it on first sign-in."
      submitLabel="Create account"
      loading={mutation.isPending}
      error={mutation.error}
      submitDisabled={form.name.trim().length < 2 || !form.email.trim()}
      onSubmit={() => mutation.mutate(form)}
    >
      <div className="space-y-4">
        <LabeledInput label="Full name">
          <input required minLength={2} className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </LabeledInput>
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledInput label="Work email" hint="This is their sign-in ID.">
            <input type="email" required className={inputClass} value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </LabeledInput>
          <LabeledInput label="Phone (optional)">
            <input type="tel" className={inputClass} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </LabeledInput>
        </div>
        <LabeledInput label="Role" hint={`${ROLE_SUMMARY[form.role]} Add custom roles later under Role assignments.`}>
          <select className={inputClass} value={form.role} onChange={(e) => set({ role: e.target.value as PlatformRole })}>
            {ROLE_ORDER.map((role) => (
              <option key={role} value={role}>
                {PLATFORM_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </LabeledInput>
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledInput label="Job title (optional)">
            <input className={inputClass} value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </LabeledInput>
          <LabeledInput label="Location (optional)">
            <input className={inputClass} value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </LabeledInput>
        </div>
        {canSeeOrg ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledInput label="Department">
              <select className={inputClass} value={form.departmentId} onChange={(e) => set({ departmentId: e.target.value, teamId: '' })}>
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
                value={form.teamId}
                onChange={(e) => {
                  const team = teamOptions.find((t) => t.id === e.target.value);
                  set({ teamId: e.target.value, departmentId: team ? team.departmentId : form.departmentId });
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
        {canPickManager ? (
          <LabeledInput label="Reports to (optional)">
            <StaffPicker value={form.manager} onChange={(manager) => set({ manager })} />
          </LabeledInput>
        ) : null}
      </div>
    </FormDrawer>
  );
}
