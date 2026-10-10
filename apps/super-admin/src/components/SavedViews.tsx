import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { reportsApi } from '@/lib/platform-api';
import { useAuthStore } from '@/stores/auth';

/** Named filter presets per page; shared views are visible to every staff member. */
export function SavedViews({
  page,
  filters,
  onApply,
}: {
  page: string;
  filters: Record<string, string>;
  onApply: (filters: Record<string, string>) => void;
}) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.admin);
  const key = ['super-admin', 'saved-views', page];
  const views = useQuery({ queryKey: key, queryFn: () => reportsApi.views(page) });
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const save = useMutation({
    mutationFn: () => reportsApi.createView({ page, name: name.trim(), filters, isShared: shared }),
    onSuccess: () => {
      setNaming(false);
      setName('');
      qc.invalidateQueries({ queryKey: key });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => reportsApi.deleteView(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const activeFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {views.data?.map((v) => (
        <span key={v.id} className="inline-flex items-center rounded-full border border-line">
          <button type="button" className="px-3 py-1 hover:text-accent" onClick={() => onApply(v.filters)}>
            {v.name}
            {v.isShared ? ' · shared' : ''}
          </button>
          {v.userId === me?.id || me?.isOwner ? (
            <button
              type="button"
              aria-label={`Delete view ${v.name}`}
              className="pr-2 text-text-muted hover:text-status-error"
              onClick={() => remove.mutate(v.id)}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
      {naming ? (
        <span className="inline-flex items-center gap-2">
          <input
            className="rounded-lg border border-line bg-bg-card px-2 py-1"
            placeholder="View name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Share
          </label>
          <button
            type="button"
            className="font-medium text-accent disabled:opacity-50"
            disabled={!name.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </button>
          <button type="button" className="text-text-muted" onClick={() => setNaming(false)}>
            Cancel
          </button>
        </span>
      ) : activeFilters ? (
        <button type="button" className="text-accent hover:underline" onClick={() => setNaming(true)}>
          + Save view
        </button>
      ) : null}
    </div>
  );
}
