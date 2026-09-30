import { csvCell } from '@cullinos/shared';

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) {
    return columns?.map(csvCell).join(',') ?? '';
  }

  const keys = columns ?? Object.keys(rows[0]);
  const header = keys.map(csvCell).join(',');
  const body = rows.map((row) => keys.map((key) => csvCell(row[key])).join(',')).join('\n');
  return `${header}\n${body}`;
}
