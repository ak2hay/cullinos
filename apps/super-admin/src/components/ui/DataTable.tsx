import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Columns3 } from 'lucide-react';
import { cn } from '@cullinos/ui';
import { EmptyState } from './EmptyState';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  className?: string;
  headerClassName?: string;
  cell: (row: T) => ReactNode;
  /** Hidden until enabled from the column chooser. */
  defaultHidden?: boolean;
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** Plural noun for "Showing 1–20 of 54 tenants". */
  itemLabel?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
  selectedKeys?: ReadonlySet<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  /** Filters / bulk actions rendered above the table. */
  toolbar?: ReactNode;
  /** Rendered above the toolbar row (e.g. status tabs). */
  header?: ReactNode;
  columnChooser?: boolean;
  /** Cursor pagination: renders a "Load more" footer. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  /** Page-number pagination footer. */
  pagination?: PaginationProps;
  /** Render without the card chrome (when already inside a card). */
  bare?: boolean;
  skeletonRows?: number;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  emptyMessage = 'No results',
  emptyDescription,
  emptyAction,
  className,
  onRowClick,
  selectedKeys,
  onSelectionChange,
  toolbar,
  header,
  columnChooser,
  hasMore,
  onLoadMore,
  loadingMore,
  pagination,
  bare,
  skeletonRows = 5,
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

  const showToolbar = Boolean(toolbar || columnChooser);

  return (
    <section
      className={cn(
        !bare && 'overflow-hidden rounded-xl border border-line-subtle bg-bg-card shadow-sm',
        className,
      )}
    >
      {header || showToolbar ? (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {header ? <div className="min-w-0 flex-1">{header}</div> : null}
          {showToolbar ? (
            <div className={cn('flex flex-wrap items-center gap-2', header ? '' : 'min-w-0 flex-1')}>
              {toolbar}
              {columnChooser ? (
                <div className="relative ml-auto">
                  <button
                    type="button"
                    aria-expanded={chooserOpen}
                    onClick={() => setChooserOpen((o) => !o)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-text-secondary hover:bg-hover"
                  >
                    <Columns3 size={14} aria-hidden="true" />
                    Columns
                  </button>
                  {chooserOpen ? (
                    <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-line bg-bg-secondary p-2 shadow-lg">
                      {columns.map((c) => (
                        <label key={c.key} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-hover">
                          <input
                            type="checkbox"
                            className="accent-accent"
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
        </div>
      ) : null}
      <div className={cn('overflow-x-auto', Boolean(header || showToolbar) && !bare && 'px-2')}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-bg-primary text-xs font-medium text-text-muted">
              {selectable ? (
                <th className="w-10 rounded-l-lg px-4 py-3">
                  <input
                    type="checkbox"
                    className="accent-accent"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
              ) : null}
              {visible.map((col, i) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-3 font-medium',
                    !selectable && i === 0 && 'rounded-l-lg',
                    i === visible.length - 1 && 'rounded-r-lg',
                    col.headerClassName ?? col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }, (_, r) => (
                <tr key={`sk-${r}`} className="border-b border-line-subtle last:border-0">
                  {Array.from({ length: colSpan }, (_, c) => (
                    <td key={c} className="px-4 py-4">
                      <div className="ui-skeleton h-3.5 rounded" style={{ width: `${55 + ((r + c) % 4) * 10}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>
                  <EmptyState title={emptyMessage} description={emptyDescription} action={emptyAction} />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = getRowKey(row);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.target !== e.currentTarget) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      'border-b border-line-subtle transition-colors last:border-0 hover:bg-hover',
                      onRowClick &&
                        'cursor-pointer focus-visible:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                      selectable && selectedKeys!.has(key) && 'bg-accent/5',
                    )}
                  >
                    {selectable ? (
                      <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="accent-accent"
                          aria-label="Select row"
                          checked={selectedKeys!.has(key)}
                          onChange={() => toggle(key)}
                        />
                      </td>
                    ) : null}
                    {visible.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3 align-middle', col.className)}>
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
            className="text-sm font-medium text-accent hover:underline disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
      {pagination ? <Pagination {...pagination} /> : null}
    </section>
  );
}

function pageWindow(page: number, pages: number): Array<number | 'gap'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: Array<number | 'gap'> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) out.push('gap');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pages - 1) out.push('gap');
  out.push(pages);
  return out;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  itemLabel = 'results',
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const navBtn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-line px-2 text-sm text-text-secondary hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle px-4 py-3 text-sm">
      <p className="text-text-muted">
        Showing {from}–{to} of {total} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button type="button" className={navBtn} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          {pageWindow(page, pages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-text-muted">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPageChange(p)}
                className={cn(
                  navBtn,
                  p === page && 'border-accent bg-accent font-semibold text-white hover:bg-accent-dark',
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className={navBtn}
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
        {onPageSizeChange ? (
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-lg border border-line bg-bg-card px-2 text-sm text-text-secondary outline-none focus:border-accent"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}
