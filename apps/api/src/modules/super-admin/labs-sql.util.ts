import { BadRequestException } from "@nestjs/common";

const MAX_SQL_CHARS = 8_000;
const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|UPSERT|MERGE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|GRANT|REVOKE|COPY|CALL|EXECUTE|EXEC|DO|SET|RESET|SHOW|VACUUM|ANALYZE|REINDEX|CLUSTER|LISTEN|NOTIFY|UNLISTEN|SECURITY|OWNER|COMMENT|LOCK|REFRESH|REASSIGN|DISCARD|PREPARE|DEALLOCATE|DECLARE|FETCH|MOVE|CLOSE|CHECKPOINT|LOAD|IMPORT|EXPORT|ATTACH|DETACH|PRAGMA|INTO|OUTFILE|DUMPFILE)\b/i;

/**
 * Validate Super Admin labs SQL: single SELECT/WITH statement only.
 * Returns the cleaned statement (no trailing semicolon).
 */
export function assertSelectOnlySql(raw: string): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new BadRequestException("SQL is required");
  }
  if (raw.length > MAX_SQL_CHARS) {
    throw new BadRequestException(`SQL exceeds ${MAX_SQL_CHARS} characters`);
  }

  // Strip /* */ and -- line comments
  let sql = raw.replace(/\/\*[\s\S]*?\*\//g, " ");
  sql = sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n")
    .trim();

  if (!sql) {
    throw new BadRequestException("SQL is empty after removing comments");
  }

  // Reject multi-statement (any internal semicolon)
  const withoutTrailing = sql.replace(/;+\s*$/, "");
  if (withoutTrailing.includes(";")) {
    throw new BadRequestException("Multiple statements are not allowed");
  }
  sql = withoutTrailing.trim();

  const upperStart = sql.replace(/^\s+/, "").slice(0, 6).toUpperCase();
  if (!upperStart.startsWith("SELECT") && !upperStart.startsWith("WITH")) {
    throw new BadRequestException("Only SELECT or WITH (CTE) queries are allowed");
  }

  // Strip string literals so keywords inside quotes do not false-positive
  const forKeywordCheck = sql
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, "''");

  if (/\bFOR\s+UPDATE\b/i.test(forKeywordCheck)) {
    throw new BadRequestException("FOR UPDATE is not allowed");
  }

  if (FORBIDDEN.test(forKeywordCheck)) {
    throw new BadRequestException(
      "Query contains a disallowed keyword (DML/DDL or SELECT INTO)",
    );
  }

  return sql;
}

export const LABS_SQL_MAX_ROWS = 200;
export const LABS_SQL_TIMEOUT_MS = 5_000;
export const LABS_SQL_PREVIEW_CHARS = 500;
