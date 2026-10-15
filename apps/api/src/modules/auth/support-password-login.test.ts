import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { hashPassword } from "@cullinos/auth";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PlatformSupportService } from "../platform-support/platform-support.service";
import { AuthService } from "./auth.service";

type Credential = {
  id: string;
  grantId: string;
  ticketId: string;
  targetUserId: string;
  createdById: string;
  passwordHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  grant: { id: string; ticketId: string; accessLevel: "read_only" | "full"; status: string; expiresAt: Date };
};

const REAL = "Real-Password-1";
const SUPPORT = "Support-Pass-0001";
let realHash: string;
let supportHash: string;

beforeAll(async () => {
  [realHash, supportHash] = await Promise.all([hashPassword(REAL), hashPassword(SUPPORT)]);
});

function inMinutes(m: number) {
  return new Date(Date.now() + m * 60_000);
}

function credential(over: Partial<Credential> = {}): Credential {
  const expiresAt = over.expiresAt ?? inMinutes(120);
  return {
    id: "c1",
    grantId: "g1",
    ticketId: "t1",
    targetUserId: "u1",
    createdById: "staff1",
    passwordHash: supportHash,
    expiresAt,
    revokedAt: null,
    createdAt: new Date(),
    grant: { id: "g1", ticketId: "t1", accessLevel: "read_only", status: "active", expiresAt },
    ...over,
  };
}

function makeService(creds: Credential[]) {
  const user = {
    id: "u1",
    email: "owner@tenant.test",
    name: "Tenant Owner",
    phone: null,
    avatarUrl: null,
    organizationId: "org1",
    isSuperAdmin: false,
    lastLoginAt: null,
    createdAt: new Date(),
    passwordHash: realHash,
    organization: { name: "Tenant", slug: "tenant", status: "active" },
  };
  const prisma = {
    user: { findFirst: vi.fn(async () => user) },
    supportLoginCredential: {
      findMany: vi.fn(async () => {
        const now = Date.now();
        return creds.filter(
          (c) =>
            !c.revokedAt &&
            c.expiresAt.getTime() > now &&
            c.grant.status === "active" &&
            c.grant.expiresAt.getTime() > now,
        );
      }),
      update: vi.fn(async () => ({})),
    },
    tenantAccessGrant: { update: vi.fn(async () => ({})) },
    platformEmployee: { findUnique: vi.fn(async () => ({ employeeCode: "RKY-000001" })) },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  };
  const config = { get: vi.fn(() => undefined) };
  const audit = { log: vi.fn(async () => ({})) };
  const service = new AuthService(
    prisma as never,
    {} as never,
    {} as never,
    config as never,
    audit as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const issueImpersonationSession = vi
    .spyOn(service, "issueImpersonationSession")
    .mockImplementation(async (_u, impersonatedBy, expiresIn, support) => ({ impersonatedBy, expiresIn, support }) as never);
  const createAndSendOtp = vi.fn(async () => "challenge");
  (service as unknown as { createAndSendOtp: typeof createAndSendOtp }).createAndSendOtp = createAndSendOtp;
  return { service, prisma, audit, issueImpersonationSession, createAndSendOtp };
}

describe("support password login", () => {
  it("opens a support session without email OTP when the support password matches", async () => {
    const { service, issueImpersonationSession, createAndSendOtp, audit } = makeService([credential()]);
    const res = (await service.login("owner@tenant.test", SUPPORT)) as unknown as {
      impersonatedBy: string;
      expiresIn: number;
      support: { grantId: string; ticketId: string };
    };
    expect(res.impersonatedBy).toBe("staff1");
    expect(res.expiresIn).toBeLessThanOrEqual(45 * 60);
    expect(res.support).toMatchObject({ grantId: "g1", ticketId: "t1" });
    expect(issueImpersonationSession).toHaveBeenCalledOnce();
    expect(createAndSendOtp).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.login_support_password" }));
  });

  it("can be reused within the window", async () => {
    const { service, issueImpersonationSession } = makeService([credential()]);
    await service.login("owner@tenant.test", SUPPORT);
    await service.login("owner@tenant.test", SUPPORT);
    expect(issueImpersonationSession).toHaveBeenCalledTimes(2);
  });

  it("rejects a wrong password", async () => {
    const { service } = makeService([credential()]);
    await expect(service.login("owner@tenant.test", "Nope-Nope-Nope-1")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects expired, revoked or ended-grant passwords", async () => {
    const past = inMinutes(-1);
    const { service } = makeService([
      credential({ id: "expired", expiresAt: past }),
      credential({ id: "revoked", revokedAt: new Date() }),
      credential({ id: "grant-ended", grant: { ...credential().grant, status: "revoked" } }),
    ]);
    await expect(service.login("owner@tenant.test", SUPPORT)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("keeps the tenant's real password working (still asks for email OTP)", async () => {
    const { service, issueImpersonationSession } = makeService([credential()]);
    const res = await service.login("owner@tenant.test", REAL);
    expect(res).toMatchObject({ requiresOtp: true, challengeToken: "challenge" });
    expect(issueImpersonationSession).not.toHaveBeenCalled();
  });
});

describe("tenant access grant duration", () => {
  it("rejects grants longer than 4 hours", async () => {
    const prisma = {
      supportTicket: {
        findUnique: vi.fn(async () => ({ id: "t1", organizationId: "org1", status: "open", seq: 1 })),
      },
    };
    const service = new PlatformSupportService(prisma as never, {} as never, {} as never, {} as never);
    await expect(
      service.requestGrant({ sub: "staff1" }, undefined, "t1", {
        accessLevel: "read_only",
        durationMinutes: 241,
        justification: "Customer cannot see yesterday's orders",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
