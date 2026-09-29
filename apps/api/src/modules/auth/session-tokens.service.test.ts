import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionTokensService } from "./session-tokens.service";

type Row = {
  id: string;
  userId: string;
  token: string;
  familyId: string;
  portal: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
};

function makePrisma() {
  const rows = new Map<string, Row>();
  const prisma = {
    rows,
    session: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        rows.set(data.id, { revokedAt: null, replacedById: null, ...data });
        return data;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id?: string; familyId?: string; userId?: string; revokedAt: null };
          data: Partial<Row>;
        }) => {
          let count = 0;
          for (const row of rows.values()) {
            if (where.id && row.id !== where.id) continue;
            if (where.familyId && row.familyId !== where.familyId) continue;
            if (where.userId && row.userId !== where.userId) continue;
            if (row.revokedAt !== null) continue;
            Object.assign(row, data);
            count += 1;
          }
          return { count };
        },
      ),
    },
  };
  return prisma;
}

describe("SessionTokensService refresh rotation", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: SessionTokensService;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-for-session-tokens-0123456789";
    prisma = makePrisma();
    svc = new SessionTokensService(prisma as never, new JwtService({}));
  });

  async function issue() {
    return svc.issueRefreshToken({ userId: "u1", portal: "admin", tokenVersion: 0 });
  }

  it("stores only a hash of the refresh token", async () => {
    const { token, sessionId } = await issue();
    const row = prisma.rows.get(sessionId)!;
    expect(row.token).toBe(createHash("sha256").update(token).digest("hex"));
    expect(row.token).not.toBe(token);
  });

  it("rotates: consuming marks the row used and reserves the replacement id", async () => {
    const { token, sessionId, familyId } = await issue();
    const consumed = await svc.consumeRefreshToken(token);
    expect(consumed).toMatchObject({ userId: "u1", sessionId, familyId, portal: "admin" });
    const row = prisma.rows.get(sessionId)!;
    expect(row.revokedAt).toBeInstanceOf(Date);
    expect(row.replacedById).toBe(consumed.nextSessionId);
  });

  it("revokes the whole family when a rotated token is replayed after the grace window", async () => {
    const { token, familyId } = await issue();
    const consumed = await svc.consumeRefreshToken(token);
    await svc.issueRefreshToken({
      userId: "u1",
      portal: "admin",
      tokenVersion: 0,
      familyId,
      sessionId: consumed.nextSessionId,
    });
    prisma.rows.get(consumed.sessionId)!.revokedAt = new Date(Date.now() - 60_000);

    await expect(svc.consumeRefreshToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.rows.get(consumed.nextSessionId)!.revokedAt).toBeInstanceOf(Date);
  });

  it("tolerates a concurrent refresh with the same token inside the grace window", async () => {
    const { token, familyId } = await issue();
    const first = await svc.consumeRefreshToken(token);
    await svc.issueRefreshToken({
      userId: "u1",
      portal: "admin",
      tokenVersion: 0,
      familyId,
      sessionId: first.nextSessionId,
    });
    const second = await svc.consumeRefreshToken(token);
    expect(second.familyId).toBe(familyId);
    expect(second.nextSessionId).not.toBe(first.nextSessionId);
    expect(prisma.rows.get(first.nextSessionId)!.revokedAt).toBeNull();
  });

  it("rejects a logged-out token even within the grace window", async () => {
    const { token } = await issue();
    await svc.revokeByToken(token);
    await expect(svc.consumeRefreshToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects legacy refresh tokens without a session id", async () => {
    const legacy = new JwtService({}).sign(
      { sub: "u1", type: "refresh" },
      { secret: process.env.JWT_SECRET!, expiresIn: 60 },
    );
    await expect(svc.consumeRefreshToken(legacy)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
