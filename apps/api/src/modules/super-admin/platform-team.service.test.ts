import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PlatformTeamService, type PlatformActor } from "./platform-team.service";

const actor: PlatformActor = { sub: "owner_1", organizationId: "org_platform", email: "boss@rkyves.com" };

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: "u_2",
    email: "ops@rkyves.com",
    name: "Ops",
    phone: null,
    status: "active",
    platformRole: "support",
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  };
}

function setup(opts: { target?: ReturnType<typeof member> | null; otherOwners?: number; existing?: unknown } = {}) {
  const prisma = {
    user: {
      findFirst: vi.fn(async (args: { where: { id?: string } }) =>
        args.where.id ? (opts.target === undefined ? member() : opts.target) : (opts.existing ?? null),
      ),
      findMany: vi.fn(async () => [member()]),
      count: vi.fn(async () => opts.otherOwners ?? 0),
      create: vi.fn(async (args: { data: Record<string, unknown> }) =>
        member({ ...args.data, id: "u_new" }),
      ),
      update: vi.fn(async (args: { data: Record<string, unknown> }) =>
        member({ ...(opts.target ?? {}), ...args.data }),
      ),
    },
  };
  const mail = { sendPlatformStaffInvite: vi.fn(async () => true) };
  const sessions = { revokeAllForUser: vi.fn(async () => undefined) };
  const audit = { log: vi.fn(async () => ({})) };
  const service = new PlatformTeamService(
    prisma as never,
    mail as never,
    sessions as never,
    audit as never,
  );
  return { service, prisma, mail, sessions, audit };
}

describe("PlatformTeamService", () => {
  it("invites staff into the actor's platform org with a forced password change", async () => {
    const { service, prisma, mail, audit } = setup();
    const res = await service.invite(actor, {
      email: " New@Rkyves.com ",
      name: "New Person",
      platformRole: "sales",
    });
    const data = prisma.user.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      organizationId: "org_platform",
      email: "new@rkyves.com",
      isSuperAdmin: true,
      platformRole: "sales",
      mustChangePassword: true,
    });
    expect(res.temporaryPassword).toHaveLength(14);
    expect(mail.sendPlatformStaffInvite).toHaveBeenCalledOnce();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "platform.team_invite", userId: "owner_1" }),
    );
  });

  it("rejects invites for tenant emails and existing staff", async () => {
    await expect(
      setup({ existing: { id: "t1", isSuperAdmin: false } }).service.invite(actor, {
        email: "owner@restaurant.com",
        name: "Owner",
        platformRole: "viewer",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      setup({ existing: { id: "s1", isSuperAdmin: true } }).service.invite(actor, {
        email: "ops@rkyves.com",
        name: "Ops",
        platformRole: "viewer",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects unknown roles", async () => {
    await expect(
      setup().service.invite(actor, { email: "a@rkyves.com", name: "A", platformRole: "root" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks changing your own role or deactivating yourself", async () => {
    const { service } = setup();
    await expect(service.changeRole(actor, "owner_1", "viewer")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.deactivate(actor, "owner_1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("protects the last active owner", async () => {
    const target = member({ id: "u_owner2", platformRole: "owner" });
    await expect(
      setup({ target, otherOwners: 0 }).service.changeRole(actor, "u_owner2", "support"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      setup({ target, otherOwners: 0 }).service.deactivate(actor, "u_owner2"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("revokes sessions on role change and deactivation", async () => {
    const a = setup({ target: member() });
    await a.service.changeRole(actor, "u_2", "finance");
    expect(a.sessions.revokeAllForUser).toHaveBeenCalledWith("u_2");
    expect(a.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "platform.team_role_change",
        metadata: expect.objectContaining({ from: "support", to: "finance" }),
      }),
    );

    const b = setup({ target: member() });
    await b.service.deactivate(actor, "u_2", "left company");
    expect(b.sessions.revokeAllForUser).toHaveBeenCalledWith("u_2");
  });

  it("resets a member's password and signs them out", async () => {
    const { service, sessions, mail } = setup({ target: member() });
    const res = await service.resetPassword(actor, "u_2");
    expect(res.temporaryPassword).toHaveLength(14);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith("u_2");
    expect(mail.sendPlatformStaffInvite).toHaveBeenCalledWith(
      expect.objectContaining({ reset: true }),
    );
  });
});
