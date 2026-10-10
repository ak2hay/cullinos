import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Badge, Button, Drawer } from '@cullinos/ui';
import { DataTable, PageHeader, RiskPill, useConfirm } from '@/components/ui';
import { inputClass, LabeledInput, MutationError, splitList } from '@/components/common';
import { useCan } from '@/lib/permissions';
import { iamApi, type PermissionDef, type RoleDef } from '@/lib/platform-api';

type Editor = {
  id?: string;
  isSystem: boolean;
  key: string;
  name: string;
  description: string;
  permissions: Set<string>;
  ipAllowlist: string;
};

function PermissionMatrix({
  catalog,
  selected,
  readOnly,
  onToggle,
}: {
  catalog: PermissionDef[];
  selected: Set<string>;
  readOnly: boolean;
  onToggle: (key: string) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, PermissionDef[]>();
    for (const p of catalog) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m.entries()];
  }, [catalog]);
  return (
    <div className="space-y-4">
      {groups.map(([group, perms]) => (
        <div key={group}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{group}</p>
          <div className="space-y-1">
            {perms.map((p) => (
              <label key={p.key} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-hover">
                <input type="checkbox" checked={selected.has(p.key)} disabled={readOnly} onChange={() => onToggle(p.key)} />
                <span className="flex-1">
                  {p.label} <span className="font-mono text-[11px] text-text-muted">{p.key}</span>
                </span>
                {p.scopable ? <Badge variant="neutral">scopable</Badge> : null}
                <RiskPill risk={p.risk} />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RolesPage() {
  const [confirm, confirmDialog] = useConfirm();
  const qc = useQueryClient();
  const can = useCan();
  const canManage = can('iam.manage');
  const roles = useQuery({ queryKey: ['super-admin', 'iam', 'roles'], queryFn: iamApi.roles });
  const catalog = useQuery({ queryKey: ['super-admin', 'iam', 'catalog'], queryFn: iamApi.catalog });
  const [editor, setEditor] = useState<Editor | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['super-admin', 'iam', 'roles'] });

  const save = useMutation({
    mutationFn: () => {
      const e = editor!;
      const body = {
        name: e.name.trim(),
        description: e.description.trim() || undefined,
        permissions: [...e.permissions],
        ipAllowlist: splitList(e.ipAllowlist),
      };
      if (!e.id) return iamApi.createRole({ ...body, key: e.key.trim().toLowerCase() });
      return e.isSystem ? iamApi.updateRole(e.id, { ipAllowlist: body.ipAllowlist }) : iamApi.updateRole(e.id, body);
    },
    onSuccess: () => {
      setEditor(null);
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => iamApi.deleteRole(id), onSuccess: refresh });

  function open(role: RoleDef | null, clone = false) {
    if (!role) {
      setEditor({ isSystem: false, key: '', name: '', description: '', permissions: new Set(), ipAllowlist: '' });
      return;
    }
    setEditor({
      id: clone ? undefined : role.id,
      isSystem: clone ? false : role.isSystem,
      key: clone ? `${role.key}_custom` : role.key,
      name: clone ? `${role.name} (custom)` : role.name,
      description: role.description ?? '',
      permissions: new Set(role.permissions),
      ipAllowlist: role.ipAllowlist.join('\n'),
    });
  }

  const readOnly = !canManage || Boolean(editor?.isSystem);

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title="Roles"
        description="Built-in roles come from code; custom roles combine any permissions. Give people extra roles from Role assignments, optionally limited to a region or a set of tenants."
        actions={canManage ? <Button size="sm" onClick={() => open(null)}>New custom role</Button> : null}
      />
      <MutationError error={remove.error} />
      <DataTable
        rows={roles.data ?? []}
        loading={roles.isLoading}
        getRowKey={(r) => r.id}
        onRowClick={(r) => open(r)}
        columns={[
          {
            key: 'name',
            header: 'Role',
            cell: (r) => (
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="font-mono text-[11px] text-text-muted">{r.key}</p>
              </div>
            ),
          },
          { key: 'type', header: 'Type', cell: (r) => <Badge variant={r.isSystem ? 'brand' : 'neutral'}>{r.isSystem ? 'Built-in' : 'Custom'}</Badge> },
          { key: 'perms', header: 'Permissions', cell: (r) => r.permissions.length },
          { key: 'risk', header: 'Highest risk', cell: (r) => <RiskPill risk={r.maxRisk} /> },
          {
            key: 'holders',
            header: 'Holders',
            cell: (r) => (
              <span className="text-text-secondary">
                {r.isSystem ? `${r.primaryHolders} primary · ` : ''}
                {r.activeAssignments} assigned
              </span>
            ),
          },
          {
            key: 'ip',
            header: 'IP limits',
            defaultHidden: true,
            cell: (r) => (r.ipAllowlist.length ? r.ipAllowlist.join(', ') : '—'),
          },
          {
            key: 'actions',
            header: '',
            cell: (r) =>
              canManage ? (
                <div className="flex justify-end gap-3 text-xs" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="text-accent hover:underline" onClick={() => open(r, true)}>
                    Clone
                  </button>
                  {!r.isSystem ? (
                    <button
                      type="button"
                      className="text-status-error hover:underline"
                      onClick={() => void confirm({ title: `Delete role ${r.name}?` }).then((ok) => ok && remove.mutate(r.id))}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              ) : null,
          },
        ]}
        columnChooser
      />

      <Drawer
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={editor?.id ? editor.name : 'New custom role'}
        description={
          editor?.isSystem
            ? 'Built-in role: permissions are defined in code. Clone it to customise; you can still set an IP allowlist.'
            : 'Role changes may need approval before they apply.'
        }
        width="xl"
        footer={
          canManage ? (
            <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          ) : null
        }
      >
        {editor ? (
          <div className="space-y-4">
            {!editor.id ? (
              <LabeledInput label="Key" hint="Lowercase letters, digits and underscores. Cannot change later.">
                <input className={`${inputClass} font-mono`} value={editor.key} onChange={(e) => setEditor({ ...editor, key: e.target.value })} />
              </LabeledInput>
            ) : null}
            <LabeledInput label="Name">
              <input className={inputClass} value={editor.name} disabled={readOnly} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Description">
              <textarea
                className={inputClass}
                value={editor.description}
                disabled={readOnly}
                onChange={(e) => setEditor({ ...editor, description: e.target.value })}
              />
            </LabeledInput>
            <LabeledInput label="IP allowlist" hint="This role's permissions only apply from these networks. Empty = anywhere.">
              <textarea
                className={`${inputClass} font-mono`}
                value={editor.ipAllowlist}
                disabled={!canManage}
                onChange={(e) => setEditor({ ...editor, ipAllowlist: e.target.value })}
              />
            </LabeledInput>
            <p className="text-sm font-medium">{editor.permissions.size} permissions selected</p>
            {catalog.data ? (
              <PermissionMatrix
                catalog={catalog.data.permissions}
                selected={editor.permissions}
                readOnly={readOnly}
                onToggle={(key) => {
                  const next = new Set(editor.permissions);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  setEditor({ ...editor, permissions: next });
                }}
              />
            ) : null}
            <MutationError error={save.error} />
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
