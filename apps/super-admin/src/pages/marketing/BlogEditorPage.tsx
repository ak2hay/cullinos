import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EyeOff, Pencil, Plus, Rocket, Trash2 } from 'lucide-react';
import { Button } from '@cullinos/ui';
import { ActionMenu, DataTable, FilterTabs, FormDrawer, PageHeader, StatusPill, useConfirm } from '@/components/ui';
import { inputClass, LabeledInput, MutationError } from '@/components/common';
import { formatDate } from '@/lib/format';
import { marketingApi } from '@/lib/marketing-api';

type Post = Record<string, unknown> & { id: unknown; status?: unknown };
type PostForm = { slug: string; title: string; excerpt: string; body: string };

const BLANK: PostForm = { slug: '', title: '', excerpt: '', body: '' };

export function BlogEditorPage() {
  const queryClient = useQueryClient();
  const [confirm, confirmDialog] = useConfirm();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<PostForm>(BLANK);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['marketing', 'blog', statusFilter],
    queryFn: () => marketingApi.listBlog(statusFilter === 'all' ? undefined : statusFilter),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['marketing', 'blog'] });

  const createMutation = useMutation({
    mutationFn: marketingApi.createBlog,
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => marketingApi.updateBlog(id, body),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });
  const deleteMutation = useMutation({ mutationFn: marketingApi.deleteBlog, onSuccess: invalidate });
  const publishMutation = useMutation({ mutationFn: marketingApi.publishBlog, onSuccess: invalidate });
  const unpublishMutation = useMutation({ mutationFn: marketingApi.unpublishBlog, onSuccess: invalidate });

  function openEditor(post?: Post) {
    createMutation.reset();
    updateMutation.reset();
    if (post) {
      setEditingId(String(post.id));
      setForm({
        slug: String(post.slug ?? ''),
        title: String(post.title ?? ''),
        excerpt: String(post.excerpt ?? ''),
        body: String(post.body ?? ''),
      });
    } else {
      setEditingId('new');
      setForm(BLANK);
    }
  }

  function submit() {
    if (editingId === 'new') createMutation.mutate(form);
    else if (editingId) updateMutation.mutate({ id: editingId, body: { ...form } });
  }

  const rows = posts as Post[];

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title="Blog"
        description="Create, edit, publish, or delete posts. Publishing a post makes it live without a full site publish."
        actions={
          <Button size="sm" onClick={() => openEditor()}>
            <Plus size={16} aria-hidden="true" />
            New post
          </Button>
        }
      />
      <MutationError error={deleteMutation.error ?? publishMutation.error ?? unpublishMutation.error} />

      <DataTable
        rows={rows}
        loading={isLoading}
        getRowKey={(p) => String(p.id)}
        onRowClick={(p) => openEditor(p)}
        emptyMessage="No posts in this filter"
        emptyAction={
          <Button size="sm" onClick={() => openEditor()}>
            New post
          </Button>
        }
        header={
          <FilterTabs
            label="Post status"
            value={statusFilter}
            onChange={setStatusFilter}
            tabs={[
              { id: 'all', label: 'All posts' },
              { id: 'draft', label: 'Drafts' },
              { id: 'published', label: 'Published' },
            ]}
          />
        }
        columns={[
          {
            key: 'title',
            header: 'Post',
            cell: (p) => (
              <div className="min-w-0">
                <p className="font-medium">{String(p.title ?? 'Untitled')}</p>
                <p className="truncate text-xs text-text-muted">/{String(p.slug ?? '')}</p>
              </div>
            ),
          },
          {
            key: 'excerpt',
            header: 'Excerpt',
            className: 'max-w-sm text-text-secondary',
            cell: (p) => <span className="line-clamp-2 text-xs">{String(p.excerpt || '—')}</span>,
          },
          { key: 'status', header: 'Status', cell: (p) => <StatusPill status={String(p.status)} /> },
          {
            key: 'updated',
            header: 'Updated',
            className: 'whitespace-nowrap text-text-secondary',
            cell: (p) => formatDate((p.updatedAt ?? p.createdAt) as string | undefined),
          },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            className: 'w-12 text-right',
            cell: (p) => {
              const id = String(p.id);
              const draft = p.status === 'draft';
              return (
                <ActionMenu
                  actions={[
                    { label: 'Edit', icon: Pencil, onSelect: () => openEditor(p) },
                    { label: 'Publish', icon: Rocket, hidden: !draft, onSelect: () => publishMutation.mutate(id) },
                    { label: 'Unpublish', icon: EyeOff, hidden: draft, onSelect: () => unpublishMutation.mutate(id) },
                    {
                      label: 'Delete',
                      icon: Trash2,
                      danger: true,
                      onSelect: () =>
                        void confirm({ title: 'Delete this post?', description: String(p.title ?? ''), confirmLabel: 'Delete' }).then(
                          (ok) => ok && deleteMutation.mutate(id),
                        ),
                    },
                  ]}
                />
              );
            },
          },
        ]}
      />

      <FormDrawer
        open={editingId != null}
        onClose={() => setEditingId(null)}
        title={editingId === 'new' ? 'New post' : 'Edit post'}
        description={editingId === 'new' ? 'Posts are created as drafts.' : undefined}
        submitLabel={editingId === 'new' ? 'Create draft' : 'Save changes'}
        loading={createMutation.isPending || updateMutation.isPending}
        error={editingId === 'new' ? createMutation.error : updateMutation.error}
        submitDisabled={!form.slug.trim() || !form.title.trim() || !form.body.trim()}
        onSubmit={submit}
        width="xl"
      >
        <div className="space-y-4">
          <LabeledInput label="Title">
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </LabeledInput>
          <LabeledInput label="Slug" hint="Used in the post URL.">
            <input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={`${inputClass} font-mono`} />
          </LabeledInput>
          <LabeledInput label="Excerpt">
            <textarea rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className={inputClass} />
          </LabeledInput>
          <LabeledInput label="Body (Markdown)">
            <textarea required rows={16} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={`${inputClass} font-mono text-xs`} />
          </LabeledInput>
        </div>
      </FormDrawer>
    </div>
  );
}
