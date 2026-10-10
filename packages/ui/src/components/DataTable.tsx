import { useState, type ReactNode } from 'react';
import { cn } from '../utils';
import { EmptyState } from './EmptyState';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
  /** Hidden until enabled from the column chooser. */
  defaultHidden?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: T) => void;
  /** Row selection for bulk actions; pass both to enable checkboxes. */
  selectedKeys?: ReadonlySet<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  /** Filters / bulk actions rendered above the table. */
  toolbar?: ReactNode;
  /** Shows a "Columns" menu to hide or show columns. */
  columnChooser?: boolean;
  /** Cursor pagination: renders a "Load more" footer. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  emptyMessage = 'No results.',
  className,
  onRowClick,
  selectedKeys,
  onSelectionChange,
  toolbar,
  columnChooser,
  hasMore,
  onLoadMore,
  loadingMore,
}: DataTableProps<T>) {
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
  );
  const [chooserOpen, setChooserOpen] = useState(false);
  const selectable = Boolean(selectedKeys && onSelectionChange);
  const visible = columns.filter((c) => !hidden.has(c.key));
  const colSpan = visible.length + (selectable ? 1 : 0);
  const keys = rows.map(getRowKey);
  const allSelected = selectable && keys.length > 0 && keys.every((k) => selectedKeys!.has(k));

  function toggleAll() {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (allSelected) keys.forEach((k) => next.delete(k));
    else keys.forEach((k) => next.add(k));
    onSelectionChange(next);
  }

  function toggle(key: string) {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  }

  const showHeaderBar = Boolean(toolbar || columnChooser);

  return (
    <section
      className={cn('overflow-hidden rounded-xl border border-line-subtle bg-bg-card', className)}
    >
      {showHeaderBar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          {columnChooser ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setChooserOpen((o) => !o)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-text-secondary hover:bg-hover"
              >
                Columns
              </button>
              {chooserOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-line bg-bg-secondary p-2 shadow-lg">
                  {columns.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 px-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={!hidden.has(c.key)}
                        onChange={() =>
                          setHidden((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.key)) next.delete(c.key);
                            else next.add(c.key);
                            return next;
                          })
                        }
                      />
                      {c.header || c.key}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line-subtle bg-bg-elevated text-text-secondary">
            <tr>
              {selectable ? (
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={toggleAll} />
                </th>
              ) : null}
              {visible.map((col) => (
                <th key={col.key} className={cn('px-4 py-3 font-medium', col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan}>
                  <EmptyState>Loading…</EmptyState>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>
                  <EmptyState>{emptyMessage}</EmptyState>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = getRowKey(row);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-line-subtle last:border-0',
                      onRowClick && 'cursor-pointer hover:bg-hover',
                      selectable && selectedKeys!.has(key) && 'bg-brand-primary/5',
                    )}
                  >
                    {selectable ? (
                      <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={selectedKeys!.has(key)}
                          onChange={() => toggle(key)}
                        />
                      </td>
                    ) : null}
                    {visible.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3', col.className)}>
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {hasMore && onLoadMore ? (
        <div className="border-t border-line-subtle px-4 py-3 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="text-sm font-medium text-brand-primary hover:underline disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
