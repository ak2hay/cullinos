import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MessageSquareQuote, Pencil, Plus, Quote, Trash2 } from 'lucide-react';
import { Button } from '@cullinos/ui';
import { ActionMenu, Card, EmptyState, EntityAvatar, FilterTabs, FormDrawer, PageHeader, useConfirm } from '@/components/ui';
import { inputClass, LabeledInput, MutationError } from '@/components/common';
import { marketingApi } from '@/lib/marketing-api';

type Testimonial = {
  id: string;
  quote: string;
  author: string;
  role: string;
  sortOrder?: number;
  status?: string;
};

const BLANK = { quote: '', author: '', role: '', sortOrder: '0' };

export function TestimonialsEditorPage() {
  const queryClient = useQueryClient();
  const [confirm, confirmDialog] = useConfirm();
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(BLANK);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['marketing', 'testimonials', status],
    queryFn: () => marketingApi.listTestimonials(status) as Promise<Testimonial[]>,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['marketing', 'testimonials'] });
  const body = () => ({ quote: draft.quote, author: draft.author, role: draft.role, sortOrder: Number(draft.sortOrder) || 0 });

  const createMutation = useMutation({
    mutationFn: () => marketingApi.createTestimonial(body()),
    onSuccess: () => {
      setCreating(false);
      setDraft(BLANK);
      invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => marketingApi.updateTestimonial(editing!.id, body()),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => marketingApi.deleteTestimonial(id),
    onSuccess: invalidate,
  });

  function startEdit(item: Testimonial) {
    updateMutation.reset();
    setEditing(item);
    setCreating(false);
    setDraft({ quote: item.quote, author: item.author, role: item.role, sortOrder: String(item.sortOrder ?? 0) });
  }

  function startCreate() {
    createMutation.reset();
    setCreating(true);
    setEditing(null);
    setDraft(BLANK);
  }

  const open = creating || Boolean(editing);
  const closeDrawer = () => {
    setCreating(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title="Testimonials"
        description="Customer quotes for the marketing site."
        actions={
          <Button size="sm" onClick={startCreate}>
            <Plus size={16} aria-hidden="true" />
            Add testimonial
          </Button>
        }
      />

      <FilterTabs
        label="Testimonial status"
        value={status}
        onChange={setStatus}
        tabs={[
          { id: 'draft', label: 'Draft' },
          { id: 'published', label: 'Published' },
        ]}
      />
      <MutationError error={deleteMutation.error} />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-bg-secondary" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessageSquareQuote}
            title={`No ${status} testimonials`}
            description="Add a customer quote to show social proof on the site."
            action={
              <Button size="sm" onClick={startCreate}>
                Add testimonial
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <Quote size={20} className="text-accent/60" aria-hidden="true" />
                <ActionMenu
                  actions={[
                    { label: 'Edit', icon: Pencil, onSelect: () => startEdit(item) },
                    {
                      label: 'Delete',
                      icon: Trash2,
                      danger: true,
                      onSelect: () =>
                        void confirm({ title: 'Delete this testimonial?', description: `Quote by ${item.author}`, confirmLabel: 'Delete' }).then(
                          (ok) => ok && deleteMutation.mutate(item.id),
                        ),
                    },
                  ]}
                />
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-text-secondary">{item.quote}</p>
              <div className="mt-4 flex items-center gap-3 border-t border-line-subtle pt-4">
                <EntityAvatar name={item.author} size={36} rounded="full" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.author}</p>
                  <p className="truncate text-xs text-text-muted">{item.role}</p>
                </div>
                <span className="ml-auto text-xs tabular-nums text-text-muted">#{item.sortOrder ?? 0}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <FormDrawer
        open={open}
        onClose={closeDrawer}
        title={editing ? 'Edit testimonial' : 'New testimonial'}
        submitLabel="Save"
        loading={createMutation.isPending || updateMutation.isPending}
        error={editing ? updateMutation.error : createMutation.error}
        submitDisabled={!draft.quote.trim() || !draft.author.trim()}
        onSubmit={() => (editing ? updateMutation.mutate() : createMutation.mutate())}
      >
        <div className="space-y-4">
          <LabeledInput label="Quote">
            <textarea value={draft.quote} onChange={(e) => setDraft({ ...draft, quote: e.target.value })} rows={5} className={inputClass} />
          </LabeledInput>
          <LabeledInput label="Author">
            <input value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} className={inputClass} />
          </LabeledInput>
          <LabeledInput label="Role">
            <input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} className={inputClass} />
          </LabeledInput>
          <LabeledInput label="Sort order" hint="Lower numbers appear first.">
            <input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} className={inputClass} />
          </LabeledInput>
        </div>
      </FormDrawer>
    </div>
  );
}
