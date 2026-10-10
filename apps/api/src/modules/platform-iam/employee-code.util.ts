export const EMPLOYEE_CODE_PREFIX = "RKY-";

export function formatEmployeeCode(n: number): string {
  return `${EMPLOYEE_CODE_PREFIX}${String(n).padStart(6, "0")}`;
}

export function parseEmployeeCode(code: string | null | undefined): number | null {
  if (!code?.startsWith(EMPLOYEE_CODE_PREFIX)) return null;
  const n = Number(code.slice(EMPLOYEE_CODE_PREFIX.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function nextEmployeeCode(existing: readonly string[]): string {
  const max = existing.reduce((m, c) => Math.max(m, parseEmployeeCode(c) ?? 0), 0);
  return formatEmployeeCode(max + 1);
}
