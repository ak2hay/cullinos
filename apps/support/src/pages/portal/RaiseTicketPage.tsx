import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@cullinos/ui';
import { Label, Notice, Panel, inputClass, textareaClass } from '@/components/common';
import { errorMessage } from '@/lib/api';
import { CATEGORY_LABELS, customerApi } from '@/lib/support-api';

const PRIORITIES = [
  { value: 'low', label: 'Low: question or minor issue' },
  { value: 'normal', label: 'Normal: something is not working right' },
  { value: 'high', label: 'High: service is blocked (orders, billing, POS down)' },
] as const;

export function RaiseTicketPage() {
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [phone, setPhone] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(subject.trim()), 400);
    return () => clearTimeout(t);
  }, [subject]);

  const suggestions = useQuery({
    queryKey: ['portal', 'articles', 'suggest', debounced],
    queryFn: () => customerApi.articles({ q: debounced }),
    enabled: debounced.length >= 4,
  });

  const create = useMutation({
    mutationFn: () => customerApi.create({ subject, description, category, priority, requesterPhone: phone || undefined }),
    onSuccess: (t) => navigate(`/tickets/${t.id}`, { replace: true, state: { created: true } }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Raise a ticket</h1>
        <p className="text-sm text-text-secondary">Tell us what is happening. You will get an email when our team replies.</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Panel>
          <div className="space-y-4">
            <Label label="Subject">
              <input
                required
                minLength={4}
                maxLength={200}
                className={inputClass}
                placeholder="e.g. KOT printer stopped printing"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Label>
            {(suggestions.data ?? []).length > 0 ? (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
                <p className="font-medium">These articles might help:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {suggestions.data!.slice(0, 4).map((a) => (
                    <li key={a.id}>
                      <Link to={`/kb/${a.slug}`} target="_blank" className="text-accent hover:underline">
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
              <Label label="How urgent is it?">
                <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Label>
            </div>
            <Label label="Description" hint="Include steps to reproduce, the outlet, order numbers and screenshots links if you have them.">
              <textarea
                required
                minLength={10}
                className={`${textareaClass} min-h-40`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Label>
            <Label label="Contact phone (optional)" hint="Defaults to the phone on your account.">
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Label>
          </div>
        </Panel>
        {create.error ? <Notice tone="error">{errorMessage(create.error)}</Notice> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Submit ticket
          </Button>
        </div>
      </form>
    </div>
  );
}
