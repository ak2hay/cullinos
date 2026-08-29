import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { marketingApi } from '@/lib/marketing-api';

export function BlogEditorPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['marketing', 'blog'],
    queryFn: () => marketingApi.listBlog('draft'),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Blog</h1>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-primary"
        >
          New post
        </button>
      </div>

      {editing === 'new' ? (
        <form
          className="space-y-3 rounded-xl border border-white/10 bg-bg-card p-5"
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
          <input name="slug" placeholder="slug" required className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" />
          <input name="title" placeholder="Title" required className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" />
          <input name="excerpt" placeholder="Excerpt" className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" />
          <textarea name="body" placeholder="Markdown body" rows={8} required className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm font-mono" />
          <button type="submit" className="rounded-lg bg-brand-primary px-4 py-2 text-sm">Create draft</button>
        </form>
      ) : null}

      {isLoading ? (
        <p className="text-text-muted">Loading posts…</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <form
              key={String(post.id)}
              className="space-y-3 rounded-xl border border-white/10 bg-bg-card p-5"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateMutation.mutate({
                  id: String(post.id),
                  body: {
                    title: fd.get('title'),
                    excerpt: fd.get('excerpt'),
                    body: fd.get('body'),
                  },
                });
              }}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{String(post.slug)}</p>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(String(post.id))}
                  className="text-xs text-status-error hover:underline"
                >
                  Delete
                </button>
              </div>
              <input name="title" defaultValue={String(post.title)} className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" />
              <input name="excerpt" defaultValue={String(post.excerpt ?? '')} className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" />
              <textarea name="body" defaultValue={String(post.body)} rows={6} className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm font-mono" />
              <button type="submit" className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5">Save</button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
