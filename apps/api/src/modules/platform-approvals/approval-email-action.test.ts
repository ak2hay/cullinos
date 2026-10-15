import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PlatformApprovalsService, hashEmailToken } from "./platform-approvals.service";

const TOKEN = "t".repeat(43);

function setup(opts: { usedAt?: Date | null; claimed?: number; decideError?: Error } = {}) {
  const tokenRow = {
    id: "tok_1",
    requestId: "req_1",
    approverId: "owner_2",
    tokenHash: hashEmailToken(TOKEN),
    expiresAt: new Date(Date.now() + 3600_000),
    usedAt: opts.usedAt ?? null,
  };
  const request = {
    id: "req_1",
    seq: 12,
    title: "Delete tenant Foo",
    actionKey: "tenants.delete",
    justification: "Customer asked to close the account",
    status: "pending",
    requestedById: "u_1",
    expiresAt: new Date(Date.now() + 72 * 3600_000),
  };
  const prisma = {
    platformApprovalEmailToken: {
      findUnique: vi.fn(async () => ({ ...tokenRow, request })),
      updateMany: vi.fn(async () => ({ count: opts.claimed ?? 1 })),
      update: vi.fn(async () => tokenRow),
    },
    platformApprovalRequest: {
      findUniqueOrThrow: vi.fn(async () => request),
      findMany: vi.fn(async () => []),
    },
    user: {
      findFirst: vi.fn(async () => ({ id: "owner_2", email: "boss@rkyves.com", organizationId: "org_p" })),
      findMany: vi.fn(async () => [
        { id: "u_1", name: "Requester", email: "r@rkyves.com", platformEmployee: null },
        { id: "owner_2", name: "Boss", email: "boss@rkyves.com", platformEmployee: null },
      ]),
    },
  };
  const audit = { log: vi.fn(async () => ({})) };
  const service = new PlatformApprovalsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    audit as never,
  );
  const decide = vi
    .spyOn(service, "decide")
    .mockImplementation(async () => {
      if (opts.decideError) throw opts.decideError;
      return {} as never;
    });
  return { service, prisma, audit, decide };
}

describe("approve from email", () => {
  it("previews the request without exposing the payload", async () => {
    const { service, prisma } = setup();
    const res = await service.emailActionPreview(TOKEN);
    expect(prisma.platformApprovalEmailToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashEmailToken(TOKEN) } }),
    );
    expect(res).toMatchObject({ ref: expect.any(String), canDecide: true, linkState: "valid", approverName: "Boss" });
    expect(res).not.toHaveProperty("payload");
  });

  it("consumes the link and records the decision as the emailed approver", async () => {
    const { service, decide, audit } = setup();
    await service.decideFromEmail(TOKEN, "approved");
    expect(decide).toHaveBeenCalledWith({ sub: "owner_2", email: "boss@rkyves.com" }, "req_1", "approved", undefined);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { decision: "approved", source: "email" } }),
    );
  });

  it("refuses a link that was already used", async () => {
    const { service, decide } = setup({ usedAt: new Date(), claimed: 0 });
    await expect(service.decideFromEmail(TOKEN, "approved")).rejects.toBeInstanceOf(ConflictException);
    expect(decide).not.toHaveBeenCalled();
  });

  it("needs a comment to reject", async () => {
    const { service, prisma } = setup();
    await expect(service.decideFromEmail(TOKEN, "rejected")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.platformApprovalEmailToken.updateMany).not.toHaveBeenCalled();
  });

  it("gives the link back when the decision fails for a fixable reason", async () => {
    const { service, prisma } = setup({ decideError: new BadRequestException("nope") });
    await expect(service.decideFromEmail(TOKEN, "approved")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.platformApprovalEmailToken.update).toHaveBeenCalledWith({ where: { id: "tok_1" }, data: { usedAt: null } });
  });
});
