import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/ui';
import { inputClass } from '@/components/common';
import { peopleApi, type OrgNode } from '@/lib/platform-api';

function Node({
  node,
  childrenOf,
  depth,
  match,
}: {
  node: OrgNode;
  childrenOf: Map<string, OrgNode[]>;
  depth: number;
  match: (n: OrgNode) => boolean;
}) {
  const kids = childrenOf.get(node.userId) ?? [];
  const [open, setOpen] = useState(depth < 2);
  return (
    <li>
      <div
        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${match(node) ? 'bg-accent/10' : ''}`}
        style={{ marginLeft: depth * 20 }}
      >
        {kids.length ? (
          <button type="button" className="w-5 text-text-muted" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Collapse' : 'Expand'}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <Link to={`/people/${node.userId}`} className="font-medium hover:text-accent">
          {node.name}
        </Link>
        <span className="text-xs text-text-muted">
          {node.employeeCode} · {node.title ?? node.primaryRole ?? ''}
          {node.team ? ` · ${node.team.name}` : ''}
          {kids.length ? ` · ${kids.length} report${kids.length > 1 ? 's' : ''}` : ''}
        </span>
      </div>
      {open && kids.length ? (
        <ul>
          {kids.map((k) => (
            <Node key={k.userId} node={k} childrenOf={childrenOf} depth={depth + 1} match={match} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrgChartPage() {
  const query = useQuery({ queryKey: ['super-admin', 'org-chart'], queryFn: peopleApi.orgChart });
  const [q, setQ] = useState('');
  const { roots, childrenOf } = useMemo(() => {
    const nodes = query.data ?? [];
    const ids = new Set(nodes.map((n) => n.userId));
    const childrenOf = new Map<string, OrgNode[]>();
    const roots: OrgNode[] = [];
    for (const n of nodes) {
      if (n.managerUserId && ids.has(n.managerUserId)) {
        childrenOf.set(n.managerUserId, [...(childrenOf.get(n.managerUserId) ?? []), n]);
      } else {
        roots.push(n);
      }
    }
    return { roots, childrenOf };
  }, [query.data]);
  const needle = q.trim().toLowerCase();
  const match = (n: OrgNode) =>
    Boolean(needle) && `${n.name} ${n.employeeCode} ${n.title ?? ''}`.toLowerCase().includes(needle);

  return (
    <div className="space-y-6">
      <PageHeader title="Org chart" description="Reporting lines. Managers review their reports' access in access review campaigns." />
      <input className={`${inputClass} max-w-sm`} placeholder="Highlight name or employee ID…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="rounded-xl border border-line-subtle bg-bg-card p-4 text-sm">
        {query.isLoading ? <p className="text-text-muted">Loading…</p> : null}
        <ul>
          {roots.map((r) => (
            <Node key={r.userId} node={r} childrenOf={childrenOf} depth={0} match={match} />
          ))}
        </ul>
      </div>
    </div>
  );
}
