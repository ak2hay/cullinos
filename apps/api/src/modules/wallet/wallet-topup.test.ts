import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { WalletService } from "./wallet.service";

function setup(opts: {
  notes?: Record<string, string>;
  status?: string;
  duplicate?: boolean;
  balancePaise?: number;
}) {
  const wallet = {
    organizationId: "org_1",
    balancePaise: opts.balancePaise ?? 0,
    updatedAt: new Date(),
  };
  const tx = {
    organizationWallet: {
      updateMany: vi.fn(
        async ({ where, data }: { where: { balancePaise?: { gte: number } }; data: { balancePaise: { increment: number } } }) => {
          if (where.balancePaise && wallet.balancePaise < where.balancePaise.gte) return { count: 0 };
          wallet.balancePaise += data.balancePaise.increment;
          return { count: 1 };
        },
      ),
      count: vi.fn(async () => 1),
      findUniqueOrThrow: vi.fn(async () => ({ ...wallet })),
    },
    walletLedgerEntry: {
      create: vi.fn(async () => {
        if (opts.duplicate) {
          throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" });
        }
        return { id: "entry" };
      }),
    },
  };
  const prisma = {
    organizationWallet: {
      upsert: vi.fn(async () => wallet),
      findUnique: vi.fn(async () => ({ ...wallet })),
    },
    walletLedgerEntry: { findFirst: vi.fn(async () => null) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const razorpay = {
    requireConfigured: vi.fn(),
    verifyPaymentSignature: vi.fn(() => true),
    fetchOrder: vi.fn(async () => ({
      id: "order_rzp",
      amount: 50_000,
      currency: "INR",
      status: opts.status ?? "paid",
      notes: opts.notes ?? { purpose: "wallet_topup", organizationId: "org_1" },
    })),
  };
  const config = { get: vi.fn(() => undefined) };
  const service = new WalletService(prisma as never, config as never, razorpay as never);
  return { service, tx, wallet };
}

const input = { razorpayOrderId: "order_rzp", razorpayPaymentId: "pay_1", razorpaySignature: "sig" };

describe("WalletService.confirmTopUp", () => {
  it("credits a paid top-up created for this organization", async () => {
    const { service, wallet, tx } = setup({});
    await expect(service.confirmTopUp("org_1", input)).resolves.toMatchObject({ alreadyCredited: false });
    expect(wallet.balancePaise).toBe(50_000);
    expect(tx.walletLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ id: "topup_order_rzp" }) }),
    );
  });

  it("rejects a top-up order paid by another organization", async () => {
    const { service, wallet } = setup({ notes: { purpose: "wallet_topup", organizationId: "org_other" } });
    await expect(service.confirmTopUp("org_1", input)).rejects.toThrow(BadRequestException);
    expect(wallet.balancePaise).toBe(0);
  });

  it("rejects non-wallet Razorpay orders (e.g. SaaS or diner payments)", async () => {
    const { service } = setup({ notes: { kind: "saas", organizationId: "org_1" } });
    await expect(service.confirmTopUp("org_1", input)).rejects.toThrow(BadRequestException);
  });

  it("rejects orders that are not paid yet", async () => {
    const { service } = setup({ status: "attempted" });
    await expect(service.confirmTopUp("org_1", input)).rejects.toThrow(BadRequestException);
  });

  it("reports alreadyCredited when a concurrent confirm won the ledger id", async () => {
    const { service } = setup({ duplicate: true });
    await expect(service.confirmTopUp("org_1", input)).resolves.toMatchObject({ alreadyCredited: true });
  });
});

describe("WalletService.debit", () => {
  it("never overdraws when the balance is insufficient", async () => {
    const { service, wallet } = setup({ balancePaise: 500 });
    await expect(service.debit("org_1", 600, "sms_charge")).rejects.toThrow("Insufficient wallet balance");
    expect(wallet.balancePaise).toBe(500);
  });
});
