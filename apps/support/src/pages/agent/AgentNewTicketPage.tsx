import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@cullinos/ui';
import { Label, Notice, Panel, inputClass, textareaClass } from '@/components/common';
import { errorMessage } from '@/lib/api';
import { CATEGORY_LABELS, PRIORITY_LABELS, agentApi, type TicketPriority } from '@/lib/support-api';
import { useCanAgent } from '@/stores/session';

function TenantPicker({
  value,
  onChange,
}: {
  value: { id: string; name: string } | null;
  onChange: (v: { id: string; name: string } | null) => void;
}) {
  const [q, setQ] = useState('');
  const results = useQuery({
    queryKey: ['agent', 'tenants', q],
    queryFn: () => agentApi.tenants(q),
    enabled: q.trim().length >= 2,
  });
  if (value) {
    return (
      <div className={`${inputClass} flex items-center justify-between`}>
        <span className="truncate">{value.name}</span>
        <button type="button" className="text-xs text-text-muted hover:text-text-primary" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input className={inputClass} placeholder="Search restaurant name…" value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim().length >= 2 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-bg-card shadow-lg">
          {(results.data?.data ?? []).map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-hover"
                onClick={() => {
                  onChange({ id: o.id, name: o.name });
                  setQ('');
                }}
              >
                {o.name} <span className="text-xs text-text-muted">{o.slug}</span>
              </button>
            </li>
          ))}
          {results.data && results.data.data.length === 0 ? <li className="px-3 py-2 text-sm text-text-muted">No matches</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

export function AgentNewTicketPage() {
  const navigate = useNavigate();
  const can = useCanAgent();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [tenant, setTenant] = useState<{ id: string; name: string } | null>(null);
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [teamId, setTeamId] = useState('');
  const teams = useQuery({ queryKey: ['agent', 'teams'], queryFn: agentApi.teams, enabled: can('tickets.assign') });

  const create = useMutation({
    mutationFn: () =>
      agentApi.create({
        subject,
        description,
        category,
        priority,
        organizationId: tenant?.id ?? null,
        requesterName: requesterName || undefined,
        requesterEmail: requesterEmail || undefined,
        requesterPhone: requesterPhone || undefined,
        assigneeTeamId: teamId || null,
      }),
    onSuccess: (t) => navigate(`/agent/tickets/${t.id}`, { replace: true }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">New ticket</h1>
        <p className="text-sm text-text-secondary">Log a call, email or internal issue on behalf of a restaurant.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-4"
      >
        <Panel title="Details">
          <div className="space-y-4">
            <Label label="Short description">
              <input required minLength={4} maxLength={200} className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Label>
            <Label label="Description">
              <textarea required minLength={4} className={`${textareaClass} min-h-32`} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Label label="Category">
                <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Label>
              <Label label="Priority">
                <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
                  {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </Label>
            </div>
          </div>
        </Panel>
        <Panel title="Caller">
          <div className="space-y-4">
            <Label label="Tenant (restaurant)">
              <TenantPicker value={tenant} onChange={setTenant} />
            </Label>
            <div className="grid gap-4 sm:grid-cols-3">
              <Label label="Name">
                <input className={inputClass} value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
              </Label>
              <Label label="Email" hint="Customer-visible replies are emailed here.">
                <input type="email" className={inputClass} value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} />
              </Label>
              <Label label="Phone">
                <input className={inputClass} value={requesterPhone} onChange={(e) => setRequesterPhone(e.target.value)} />
              </Label>
            </div>
          </div>
        </Panel>
        {can('tickets.assign') ? (
          <Panel title="Assignment">
            <Label label="Assignment group" hint="The on-call member of the group is assigned automatically.">
              <select className={inputClass} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">Leave unassigned</option>
                {(teams.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Label>
          </Panel>
        ) : null}
        {create.error ? <Notice tone="error">{errorMessage(create.error)}</Notice> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Submit
          </Button>
        </div>
      </form>
    </div>
  );
}
