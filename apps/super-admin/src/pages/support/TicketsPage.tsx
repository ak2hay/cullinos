import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Dialog } from '@cullinos/ui';
import { DataTable, FilterSelect, FilterTabs, PageHeader, SearchInput, StatusPill } from '@/components/ui';
import { inputClass, LabeledInput, MutationError } from '@/components/common';
import { SavedViews } from '@/components/SavedViews';
import { useCan } from '@/lib/permissions';
import { formatDateTime, iamApi, personLabel, supportApi, type TicketPriority } from '@/lib/platform-api';

const FILTER_KEYS = ['status', 'priority', 'assignee', 'teamId', 'organizationId', 'q', 'breached'] as const;

type NewTicket = {
  subject: string;
  description: string;
  organizationId: string;
  priority: TicketPriority;
  category: string;
  requesterName: string;
  requesterEmail: string;
  assigneeTeamId: string;
};

const blank: NewTicket = {
  subject: '',
  description: '',
  organizationId: '',
  priority: 'normal',
  category: 'general',
  requesterName: '',
  requesterEmail: '',
  assigneeTeamId: '',
};

export function TicketsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<string, string>;
  if (!params.has('status')) filters.status = 'open_all';
  const [search, setSearch] = useState(filters.q);
  const [form, setForm] = useState<NewTicket | null>(null);
  const teams = useQuery({ queryKey: ['super-admin', 'iam', 'teams'], queryFn: iamApi.teams });

  const query = useInfiniteQuery({
    queryKey: ['super-admin', 'tickets', filters],
    queryFn: ({ pageParam }) =>
      supportApi.tickets({
        ...Object.fromEntries(Object.entries(filters).filter(([k, v]) => v && k !== 'breached')),
        breached: filters.breached === 'true' || undefined,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: 60_000,
  });
  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];

  const create = useMutation({
    mutationFn: () => {
      const f = form!;
      return supportApi.createTicket({
        subject: f.subject.trim(),
        description: f.description.trim(),
        organizationId: f.organizationId.trim() || null,
        priority: f.priority,
        category: f.category.trim() || undefined,
        requesterName: f.requesterName.trim() || undefined,
        requesterEmail: f.requesterEmail.trim() || undefined,
        assigneeTeamId: f.assigneeTeamId || null,
      });
    },
    onSuccess: (t) => {
      setForm(null);
      qc.invalidateQueries({ queryKey: ['super-admin', 'tickets'] });
      navigate(`/support/tickets/${t.id}`);
    },
  });

  function apply(next: Record<string, string>) {
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
  }
  const set = (k: string, v: string) => apply({ ...filters, [k]: v });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support tickets"
        description="Every tenant issue and every request for tenant access starts here. SLA clocks run by priority; urgent tickets page the on-call engineer."
        actions={can('tickets.write') ? <Button size="sm" onClick={() => setForm(blank)}>New ticket</Button> : null}
      />
      <SavedViews page="tickets" filters={filters} onApply={apply} />
      <DataTable
        header={
          <FilterTabs
            label="Ticket status"
            value={filters.status}
            onChange={(v) => set('status', v)}
            tabs={[
              { id: 'open_all', label: 'All open' },
              { id: 'open', label: 'New' },
              { id: 'in_progress', label: 'In progress' },
              { id: 'waiting_customer', label: 'Waiting on customer' },
              { id: 'resolved', label: 'Resolved' },
              { id: 'closed', label: 'Closed' },
            ]}
          />
        }
        emptyMessage="No tickets match these filters"
        rows={rows}
        loading={query.isLoading}
        getRowKey={(t) => t.id}
        onRowClick={(t) => navigate(`/support/tickets/${t.id}`)}
        hasMore={query.hasNextPage}
        onLoadMore={() => query.fetchNextPage()}
        loadingMore={query.isFetchingNextPage}
        columnChooser
        toolbar={
          <>
            <SearchInput
              label="Search tickets"
              placeholder="Search subject, email, TKT-…"
              value={search}
              onChange={setSearch}
              onSubmit={() => set('q', search)}
            />
            <FilterSelect
              aria-label="Priority"
              value={filters.priority}
              onChange={(e) => set('priority', e.target.value)}
              options={[{ value: '', label: 'Any priority' }, ...['urgent', 'high', 'normal', 'low'].map((p) => ({ value: p, label: p }))]}
            />
            <FilterSelect
              aria-label="Assignee"
              value={filters.assignee}
              onChange={(e) => set('assignee', e.target.value)}
              options={[
                { value: '', label: 'Anyone' },
                { value: 'me', label: 'Assigned to me' },
                { value: 'unassigned', label: 'Unassigned' },
              ]}
            />
            <FilterSelect
              aria-label="Team"
              value={filters.teamId}
              onChange={(e) => set('teamId', e.target.value)}
              options={[{ value: '', label: 'Any team' }, ...(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))]}
            />
            <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-secondary">
              <input
                type="checkbox"
                className="accent-accent"
                checked={filters.breached === 'true'}
                onChange={(e) => set('breached', e.target.checked ? 'true' : '')}
              />
              SLA breached
            </label>
          </>
        }
        columns={[
          { key: 'ref', header: 'Ref', cell: (t) => <span className="font-mono text-xs">{t.ref}</span> },
          {
            key: 'subject',
            header: 'Subject',
            cell: (t) => (
              <div>
                <p className="font-medium">{t.subject}</p>
                <p className="text-xs text-text-muted">{t.organization?.name ?? 'No tenant'} · {t.category}</p>
              </div>
            ),
          },
          { key: 'priority', header: 'Priority', cell: (t) => <StatusPill status={t.priority} /> },
          { key: 'status', header: 'Status', cell: (t) => <StatusPill status={t.status} /> },
          { key: 'assignee', header: 'Assignee', cell: (t) => personLabel(t.assignee) },
          {
            key: 'sla',
            header: 'SLA due',
            cell: (t) =>
              t.slaBreached ? (
                <StatusPill status="breached" tone="error" />
              ) : (
                <span className="text-xs text-text-secondary">{formatDateTime(t.slaDueAt)}</span>
              ),
          },
          { key: 'created', header: 'Opened', defaultHidden: true, cell: (t) => formatDateTime(t.createdAt) },
          { key: 'requester', header: 'Requester', defaultHidden: true, cell: (t) => t.requesterEmail ?? '—' },
        ]}
      />

      <Dialog
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title="New ticket"
        size="lg"
        footer={
          <Button
            size="sm"
            loading={create.isPending}
            disabled={!form || form.subject.trim().length < 4 || form.description.trim().length < 4}
            onClick={() => create.mutate()}
          >
            Create
          </Button>
        }
      >
        {form ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <LabeledInput label="Subject">
                <input className={inputClass} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </LabeledInput>
            </div>
            <div className="sm:col-span-2">
              <LabeledInput label="Description">
                <textarea className={`${inputClass} min-h-28`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </LabeledInput>
            </div>
            <LabeledInput label="Tenant ID" hint="Needed before anyone can request access to the tenant.">
              <input className={inputClass} value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Priority">
              <select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}>
                {['low', 'normal', 'high', 'urgent'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </LabeledInput>
            <LabeledInput label="Category">
              <input className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Team" hint="Auto-assigns to the team's on-call engineer.">
              <select className={inputClass} value={form.assigneeTeamId} onChange={(e) => setForm({ ...form, assigneeTeamId: e.target.value })}>
                <option value="">None</option>
                {(teams.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </LabeledInput>
            <LabeledInput label="Requester name">
              <input className={inputClass} value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} />
            </LabeledInput>
            <LabeledInput label="Requester email">
              <input className={inputClass} value={form.requesterEmail} onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })} />
            </LabeledInput>
            <div className="sm:col-span-2">
              <MutationError error={create.error} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
