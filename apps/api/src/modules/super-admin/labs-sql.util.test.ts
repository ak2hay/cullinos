import { describe, expect, it } from "vitest";
import { assertSelectOnlySql } from "./labs-sql.util";

describe("assertSelectOnlySql", () => {
  it("allows simple SELECT", () => {
    expect(assertSelectOnlySql("SELECT id FROM organizations LIMIT 10")).toBe(
      "SELECT id FROM organizations LIMIT 10",
    );
  });

  it("allows WITH CTE", () => {
    const sql = `WITH x AS (SELECT 1 AS n) SELECT * FROM x`;
    expect(assertSelectOnlySql(sql)).toBe(sql);
  });

  it("strips comments and trailing semicolon", () => {
    expect(assertSelectOnlySql("/* note */ SELECT 1; -- end")).toBe("SELECT 1");
  });

  it("rejects empty / non-select", () => {
    expect(() => assertSelectOnlySql("")).toThrow(/required/i);
    expect(() => assertSelectOnlySql("UPDATE organizations SET name='x'")).toThrow(
      /SELECT/,
    );
    expect(() => assertSelectOnlySql("DELETE FROM organizations")).toThrow(/SELECT/);
  });

  it("rejects multi-statement and forbidden keywords", () => {
    expect(() => assertSelectOnlySql("SELECT 1; SELECT 2")).toThrow(/Multiple/);
    expect(() => assertSelectOnlySql("SELECT * INTO tmp FROM organizations")).toThrow(
      /disallowed|INTO/i,
    );
    expect(() => assertSelectOnlySql("SELECT * FROM organizations FOR UPDATE")).toThrow(
      /FOR UPDATE/,
    );
    expect(() => assertSelectOnlySql("DROP TABLE organizations")).toThrow(/SELECT/);
  });

  it("treats tagged dollar-quoted strings as literals", () => {
    const sql = "SELECT $note$ delete me $note$ AS label";
    expect(assertSelectOnlySql(sql)).toBe(sql);
  });

  it("still rejects keywords outside tagged dollar quotes", () => {
    expect(() =>
      assertSelectOnlySql("SELECT $a$x$a$ AS l, (SELECT 1) INTO tmp FROM organizations"),
    ).toThrow(/disallowed/);
  });
});
