import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { marketingApi } from '@/lib/marketing-api';

export function BlogEditorPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['marketing', 'blog', statusFilter],
    queryFn: () =>
      marketingApi.listBlog(statusFilter === 'all' ? undefined : statusFilter),
  });

  const createMutation = useMutation({
    mutationFn: marketingApi.createBlog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing', 'blog'] });
      setEditing(null);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      marketingApi.updateBlog(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'blog'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: marketingApi.deleteBlog,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'blog'] }),
  });
  const publishMutation = useMutation({
    mutationFn: marketingApi.publishBlog,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'blog'] }),
  });
  const unpublishMutation = useMutation({
    mutationFn: marketingApi.unpublishBlog,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'blog'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Blog</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Create, edit, publish, or delete posts. Publish makes a post live without a full site
            publish.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm"
          >
            <option value="all">All posts</option>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
          </select>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-primary"
          >
            New post
          </button>
        </div>
      </div>

      {editing === 'new' ? (
        <form
          className="space-y-3 rounded-xl border border-line bg-bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            createMutation.mutate({
              slug: String(fd.get('slug')),
              title: String(fd.get('title')),
              excerpt: String(fd.get('excerpt')),
              body: String(fd.get('body')),
            });
          }}
        >
          <input
            name="slug"
            placeholder="slug"
            required
            className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm"
          />
          <input
            name="title"
            placeholder="Title"
            required
            className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm"
          />
          <input
            name="excerpt"
            placeholder="Excerpt"
            className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm"
          />
          <textarea
            name="body"
            placeholder="Markdown body"
            rows={8}
            required
            className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm font-mono"
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-brand-primary px-4 py-2 text-sm">
              Create draft
            </button>
            <button
              type="button"
              className="rounded-lg border border-line px-4 py-2 text-sm"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {isLoading ? (
        <p className="text-text-muted">Loading posts…</p>
      ) : posts.length === 0 ? (
        <p className="text-text-muted">No posts in this filter.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <form
              key={String(post.id)}
              className="space-y-3 rounded-xl border border-line bg-bg-card p-5"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateMutation.mutate({
                  id: String(post.id),
                  body: {
                    title: fd.get('title'),
                    excerpt: fd.get('excerpt'),
                    body: fd.get('body'),
                    slug: fd.get('slug'),
                  },
                });
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-hover px-2 py-0.5 text-xs uppercase text-text-muted">
                  {String(post.status)}
                </span>
                <div className="flex flex-wrap gap-2">
                  {post.status === 'draft' ? (
                    <button
                      type="button"
                      className="rounded-lg bg-brand-primary/90 px-3 py-1.5 text-xs font-medium"
                      onClick={() => publishMutation.mutate(String(post.id))}
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-lg border border-line px-3 py-1.5 text-xs"
                      onClick={() => unpublishMutation.mutate(String(post.id))}
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-lg border border-status-error/40 px-3 py-1.5 text-xs text-status-error"
                    onClick={() => {
                      if (confirm('Delete this post?')) {
                        deleteMutation.mutate(String(post.id));
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <input
                name="slug"
                defaultValue={String(post.slug ?? '')}
                className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm"
              />
              <input
                name="title"
                defaultValue={String(post.title ?? '')}
                className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm"
              />
              <input
                name="excerpt"
                defaultValue={String(post.excerpt ?? '')}
                className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm"
              />
              <textarea
                name="body"
                defaultValue={String(post.body ?? '')}
                rows={6}
                className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm font-mono"
              />
              <button type="submit" className="rounded-lg border border-line px-4 py-2 text-sm">
                Save changes
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
