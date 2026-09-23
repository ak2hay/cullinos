import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, Drawer, Input, PageShell, PasswordInput, PhoneField } from '@cullinos/ui';
import { PERMISSIONS, hasAnyPermission } from '@cullinos/shared';
import { outletsApi, rolesApi, usersApi, type StaffUser } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const STAFF_ROLES = [
  { slug: 'waiter', label: 'Waiter — floor ordering' },
  { slug: 'cashier', label: 'Cashier — POS' },
  { slug: 'kitchen', label: 'Kitchen — KDS display' },
  { slug: 'manager', label: 'Manager — operations' },
];

const STAFF_STATUSES = ['active', 'inactive'] as const;

function isOwner(user: StaffUser) {
  return user.roles.some((r) => r.slug === 'owner');
}

export function StaffPage() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore((s) => s.permissions);
  const canManageStaff = hasAnyPermission(permissions, [
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.ORG_MANAGE_USERS,
  ]);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [roleSlug, setRoleSlug] = useState('waiter');
  const [outletIds, setOutletIds] = useState<string[]>([]);
  const [defaultOutletId, setDefaultOutletId] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff', 'users'],
    queryFn: usersApi.list,
  });

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: outletsApi.list,
  });

  useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.list,
  });

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      setMessage('Staff account created. Share the email and password with your team member.');
      setError(null);
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
      setDefaultOutletId('');
      setOutletIds([]);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['staff', 'users'] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: () => {
      setMessage('Staff member set to inactive. They can no longer sign in.');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['staff', 'users'] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: usersApi.activate,
    onSuccess: () => {
      setMessage('Staff member activated.');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['staff', 'users'] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      setMessage('Staff member deleted permanently.');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['staff', 'users'] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  function handleStatusChange(user: StaffUser, nextStatus: string) {
    if (nextStatus === user.status) return;
    if (nextStatus === 'inactive') {
      deactivateMutation.mutate(user.id);
    } else if (nextStatus === 'active') {
      activateMutation.mutate(user.id);
    }
  }

  function handleDelete(user: StaffUser) {
    if (
      !window.confirm(
        `Permanently delete ${user.name}? This cannot be undone and frees their email for re-invite.`,
      )
    ) {
      return;
    }
    deleteMutation.mutate(user.id);
  }

  const statusBusy =
    deactivateMutation.isPending || activateMutation.isPending || deleteMutation.isPending;

  return (
    <PageShell
      title="Staff"
      description="Create login credentials for your team. All restaurant staff accounts are added here by the owner — Cullinos does not auto-provision floor or kitchen users."
      actions={
        <Button onClick={() => setShowForm(true)} disabled={!canManageStaff}>
          Add staff member
        </Button>
      }
    >
      {message ? <p className="text-sm text-status-success">{message}</p> : null}
      {error ? <p className="text-sm text-status-error">{error}</p> : null}

      <Drawer
        open={showForm && canManageStaff}
        onClose={() => setShowForm(false)}
        title="New staff account"
        description="Share email and temporary password with your team member."
        footer={
          <Button
            type="submit"
            form="staff-create-form"
            loading={createMutation.isPending}
          >
            Create account
          </Button>
        }
      >
        <form
          id="staff-create-form"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setMessage(null);
            createMutation.mutate({
              email,
              password,
              name,
              roleSlug,
              phone: phone.trim() || undefined,
              outletIds: outletIds.length > 0 ? outletIds : outlets.map((o) => o.id),
              defaultOutletId:
                defaultOutletId ||
                (outletIds.length > 0 ? outletIds[0] : outlets[0]?.id),
            });
          }}
        >
          <Input label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
          <PhoneField
            label="Phone (Waiter OTP login)"
            value={phone}
            onChange={setPhone}
          />
          <Input
            label="Email (secondary login)"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordInput
            label="Temporary password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <label className="block">
            <span className="text-sm text-text-secondary">Role</span>
            <select
              value={roleSlug}
              onChange={(e) => setRoleSlug(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
            >
              {STAFF_ROLES.map((role) => (
                <option key={role.slug} value={role.slug}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          {outlets.length > 1 ? (
            <div>
              <p className="mb-2 text-sm text-text-secondary">Restaurant-level access</p>
              <p className="mb-2 text-xs text-text-muted">
                Limit this staff member to selected restaurants (outlets). Used for App listing, photos, and outlet settings.
              </p>
              <div className="flex flex-wrap gap-3">
                {outlets.map((outlet) => (
                  <label key={outlet.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={outletIds.includes(outlet.id)}
                      onChange={(e) => {
                        setOutletIds((prev) => {
                          const next = e.target.checked
                            ? [...prev, outlet.id]
                            : prev.filter((id) => id !== outlet.id);
                          if (!next.includes(defaultOutletId)) {
                            setDefaultOutletId(next[0] ?? '');
                          }
                          return next;
                        });
                      }}
                      className="accent-brand-primary"
                    />
                    {outlet.name}
                  </label>
                ))}
              </div>
              {(outletIds.length > 0 ? outletIds : outlets.map((o) => o.id)).length > 0 ? (
                <div className="mt-3">
                  <p className="mb-2 text-sm text-text-secondary">Default outlet (Waiter opens here)</p>
                  <div className="flex flex-wrap gap-3">
                    {(outletIds.length > 0 ? outlets.filter((o) => outletIds.includes(o.id)) : outlets).map(
                      (outlet) => (
                        <label key={`def-${outlet.id}`} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="defaultOutlet"
                            checked={
                              (defaultOutletId || outletIds[0] || outlets[0]?.id) === outlet.id
                            }
                            onChange={() => setDefaultOutletId(outlet.id)}
                            className="accent-brand-primary"
                          />
                          {outlet.name}
                        </label>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="text-sm text-status-error">{error}</p> : null}
          {message ? <p className="text-sm text-status-success">{message}</p> : null}
        </form>
      </Drawer>

      <Card padding="none" className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Outlets</th>
              <th className="px-4 py-3 font-medium">Default</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  Loading staff…
                </td>
              </tr>
            ) : (
              staff.map((user) => {
                const owner = isOwner(user);
                const statusValue =
                  user.status === 'inactive' ? 'inactive' : 'active';
                return (
                  <tr key={user.id} className="border-b border-white/5">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{user.phone || '—'}</td>
                    <td className="px-4 py-3 text-text-secondary">{user.email}</td>
                    <td className="px-4 py-3 capitalize">
                      {user.roles.map((r) => r.name).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {user.outlets.map((o) => o.name).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {user.outlets.find((o) => o.isDefault || o.id === user.defaultOutletId)?.name ||
                        user.outlets[0]?.name ||
                        '—'}
                    </td>
                    <td className="px-4 py-3">
                      {owner || !canManageStaff ? (
                        <span className="capitalize">{user.status}</span>
                      ) : (
                        <select
                          value={statusValue}
                          disabled={statusBusy}
                          onChange={(e) => handleStatusChange(user, e.target.value)}
                          className="rounded-lg border border-white/10 bg-bg-elevated px-2 py-1.5 text-sm capitalize outline-none focus:border-brand-primary disabled:opacity-60"
                        >
                          {STAFF_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {owner ? (
                        <span className="text-text-muted">Owner</span>
                      ) : !canManageStaff ? (
                        <span className="text-text-muted">—</span>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleDelete(user)}
                          loading={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
            {!isLoading && staff.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  No staff accounts yet. Add your first team member above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}
