import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import { PERMISSIONS, hasAnyPermission } from '@cullinos/shared';
import { outletsApi, rolesApi, usersApi, type StaffUser } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const STAFF_ROLES = [
  { slug: 'waiter', label: 'Waiter — floor ordering' },
  { slug: 'cashier', label: 'Cashier — POS' },
  { slug: 'kitchen', label: 'Kitchen — KDS display' },
  { slug: 'manager', label: 'Manager — operations' },
];

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
      setMessage('Staff member removed. They can no longer sign in.');
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

  function handleRemove(user: StaffUser) {
    if (!window.confirm(`Remove ${user.name}? They will no longer be able to sign in.`)) return;
    deactivateMutation.mutate(user.id);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Staff</h1>
          <p className="mt-1 max-w-2xl text-text-secondary">
            Create login credentials for your team. All restaurant staff accounts are added here
            by the owner — Cullinos does not auto-provision floor or kitchen users.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} disabled={!canManageStaff}>
          {showForm ? 'Cancel' : 'Add staff member'}
        </Button>
      </div>

      {message && !showForm ? (
        <p className="text-sm text-status-success">{message}</p>
      ) : null}
      {error && !showForm ? (
        <p className="text-sm text-status-error">{error}</p>
      ) : null}

      {showForm && canManageStaff ? (
        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">New staff account</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              setMessage(null);
              createMutation.mutate({
                email,
                password,
                name,
                roleSlug,
                outletIds: outletIds.length > 0 ? outletIds : outlets.map((o) => o.id),
              });
            }}
          >
            <Input label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Email (login)"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Temporary password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label className="block sm:col-span-2">
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
              <div className="sm:col-span-2">
                <p className="mb-2 text-sm text-text-secondary">Outlet access</p>
                <div className="flex flex-wrap gap-3">
                  {outlets.map((outlet) => (
                    <label key={outlet.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={outletIds.includes(outlet.id)}
                        onChange={(e) => {
                          setOutletIds((prev) =>
                            e.target.checked
                              ? [...prev, outlet.id]
                              : prev.filter((id) => id !== outlet.id),
                          );
                        }}
                        className="accent-brand-primary"
                      />
                      {outlet.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {error ? (
              <p className="sm:col-span-2 text-sm text-status-error">{error}</p>
            ) : null}
            {message ? (
              <p className="sm:col-span-2 text-sm text-status-success">{message}</p>
            ) : null}
            <div className="sm:col-span-2">
              <Button type="submit" loading={createMutation.isPending}>
                Create account
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Outlets</th>
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
                const inactive = user.status === 'inactive';
                return (
                  <tr key={user.id} className="border-b border-white/5">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{user.email}</td>
                    <td className="px-4 py-3 capitalize">
                      {user.roles.map((r) => r.name).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {user.outlets.map((o) => o.name).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 capitalize">{user.status}</td>
                    <td className="px-4 py-3">
                      {owner ? (
                        <span className="text-text-muted">Owner</span>
                      ) : !canManageStaff ? (
                        <span className="text-text-muted">—</span>
                      ) : inactive ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => activateMutation.mutate(user.id)}
                          loading={activateMutation.isPending}
                        >
                          Activate
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleRemove(user)}
                          loading={deactivateMutation.isPending}
                        >
                          Remove
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
      </section>
    </div>
  );
}
