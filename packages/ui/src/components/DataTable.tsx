import type { ReactNode } from 'react';
import { cn } from '../utils';
import { EmptyState } from './EmptyState';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  emptyMessage = 'No results.',
  className,
}: DataTableProps<T>) {
  return (
    <section
      className={cn('overflow-hidden rounded-xl border border-white/5 bg-bg-card', className)}
    >
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/5 bg-bg-elevated text-text-secondary">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cn('px-4 py-3 font-medium', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState>Loading…</EmptyState>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState>{emptyMessage}</EmptyState>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="border-b border-white/5 last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3', col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
