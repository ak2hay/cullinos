import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SuperAdminService } from "./super-admin.service";

const targetUser = {
  id: "user_1",
  email: "owner@cafe.test",
  name: "Cafe Owner",
  organization: { id: "org_1", name: "Cafe", slug: "cafe" },
};

function setup() {
  const handoffCreate = vi.fn(async () => ({}));
  const auditCreate = vi.fn(async () => ({}));
  const orgUpdate = vi.fn(async () => ({ id: "org_1", status: "suspended" }));
  const prisma = {
    organization: {
      findUnique: vi.fn(async () => ({
        id: "org_1",
        name: "Cafe",
        slug: "cafe",
        status: "active",
      })),
      update: orgUpdate,
    },
    user: {
      findFirst: vi.fn(async () => targetUser),
    },
    impersonationHandoff: { create: handoffCreate },
    auditLog: { create: auditCreate },
  };
  const auth = {
    issueImpersonationSession: vi.fn(async () => ({
      accessToken: "access",
      expiresAt: "2026-11-18T12:00:00.000Z",
      expiresIn: 2700,
    })),
  };
  const service = new SuperAdminService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    auth as never,
    {} as never,
  );
  return { service, prisma, auth, handoffCreate, auditCreate, orgUpdate };
}

describe("SuperAdminService action ticket", () => {
  it("rejects impersonation without a support reason for support staff", async () => {
    const { service, auth } = setup();
    await expect(
      service.impersonateOrganization("org_1", "staff_1", "short", "support"),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.impersonateOrganization("org_1", "staff_1", undefined, "support"),
    ).rejects.toThrow(/support reason/);
    expect(auth.issueImpersonationSession).not.toHaveBeenCalled();
  });

  it("lets a platform owner impersonate with no ticket and still writes the audit log", async () => {
    const { service, handoffCreate, auditCreate } = setup();
    const result = await service.impersonateOrganization("org_1", "owner_1", undefined, "owner");
    expect(result.adminUrl).toContain("impersonationCode=");
    expect(result.user.email).toBe("owner@cafe.test");
    expect(handoffCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: null, createdByUserId: "owner_1" }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "impersonate_start",
          userId: "owner_1",
          metadata: expect.objectContaining({ reason: null, handoff: true }),
        }),
      }),
    );
  });

  it("keeps a provided owner reason on the audit log", async () => {
    const { service, auditCreate } = setup();
    await service.impersonateOrganization("org_1", "owner_1", "checking a menu bug", "owner");
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ reason: "checking a menu bug" }),
        }),
      }),
    );
  });

  it("rejects suspension without a reason for support and records a null reason for owners", async () => {
    const { service, orgUpdate, auditCreate } = setup();
    await expect(service.suspendTenant("org_1", "  ", "staff_1", "support")).rejects.toThrow(
      /suspension reason/,
    );
    expect(orgUpdate).not.toHaveBeenCalled();

    await service.suspendTenant("org_1", undefined, "owner_1", "owner");
    expect(orgUpdate).toHaveBeenCalledWith({
      where: { id: "org_1" },
      data: { status: "suspended" },
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "suspend",
          userId: "owner_1",
          metadata: { reason: null },
        }),
      }),
    );
  });
});
