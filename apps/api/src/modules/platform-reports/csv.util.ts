export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = value instanceof Date ? value.toISOString() : String(value);
  // Leading = + - @ would run as formulas when opened in a spreadsheet.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
}

/** Average of (end - start) in hours over pairs that have both; null when none. */
export function averageHours(pairs: readonly { start: Date | null; end: Date | null }[]): number | null {
  const spans = pairs
    .filter((p): p is { start: Date; end: Date } => Boolean(p.start && p.end))
    .map((p) => (p.end.getTime() - p.start.getTime()) / 3600_000)
    .filter((h) => h >= 0);
  if (!spans.length) return null;
  return Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10;
}
