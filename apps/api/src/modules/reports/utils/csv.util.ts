export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) {
    return columns?.join(',') ?? '';
  }

  const keys = columns ?? Object.keys(rows[0]);
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = keys.join(',');
  const body = rows.map((row) => keys.map((key) => escape(row[key])).join(',')).join('\n');
  return `${header}\n${body}`;
}
