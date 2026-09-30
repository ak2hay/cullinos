import { describe, expect, it } from "vitest";
import { isKeyInScope } from "./marketing-upload.service";

describe("isKeyInScope", () => {
  it("allows keys inside the caller's org folder", () => {
    expect(isKeyInScope("marketing/orgs/org1/menu/a.webp", { orgId: "org1" })).toBe(true);
  });

  it("rejects another org's keys", () => {
    expect(isKeyInScope("marketing/orgs/org2/menu/a.webp", { orgId: "org1" })).toBe(false);
    expect(isKeyInScope("marketing/orgs/org10/menu/a.webp", { orgId: "org1" })).toBe(false);
  });

  it("rejects platform keys for tenants", () => {
    expect(isKeyInScope("marketing/platform/cms/hero.webp", { orgId: "org1" })).toBe(false);
  });

  it("rejects org ids that would change after sanitizing", () => {
    expect(isKeyInScope("marketing/orgs/org1/menu/a.webp", { orgId: "org1/../x" })).toBe(false);
  });

  it("platform scope never reaches tenant folders", () => {
    expect(isKeyInScope("marketing/platform/cms/hero.webp", "platform")).toBe(true);
    expect(isKeyInScope("marketing/legacy.webp", "platform")).toBe(true);
    expect(isKeyInScope("marketing/orgs/org1/menu/a.webp", "platform")).toBe(false);
  });

  it("rejects keys outside the marketing prefix", () => {
    expect(isKeyInScope("backups/db.sql", "platform")).toBe(false);
  });
});
