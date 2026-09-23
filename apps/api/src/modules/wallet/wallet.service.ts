import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import { RazorpayClient } from "../payments/razorpay.client";

const DEFAULT_SMS_PRICE_PER_100_PAISE = 10_000; // ₹100 / 100 SMS

export function smsChargePaise(sentCount: number, pricePer100Paise: number): number {
  if (sentCount <= 0 || pricePer100Paise <= 0) return 0;
  return Math.round((sentCount * pricePer100Paise) / 100);
}

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private config: PlatformConfigService,
    private razorpay: RazorpayClient,
  ) {}

  getSmsPricePer100Paise(): number {
    const raw = this.config.get("SMS_PRICE_PER_100_PAISE");
    const n = raw ? Number(raw) : DEFAULT_SMS_PRICE_PER_100_PAISE;
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_SMS_PRICE_PER_100_PAISE;
  }

  estimateSmsCost(recipientCount: number): {
    pricePer100Paise: number;
    estimatePaise: number;
  } {
    const pricePer100Paise = this.getSmsPricePer100Paise();
    return {
      pricePer100Paise,
      estimatePaise: smsChargePaise(recipientCount, pricePer100Paise),
    };
  }

  async ensureWallet(orgId: string) {
    return this.prisma.organizationWallet.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, balancePaise: 0 },
      update: {},
    });
  }

  async getBalance(orgId: string) {
    const wallet = await this.ensureWallet(orgId);
    const pricePer100Paise = this.getSmsPricePer100Paise();
    return {
      balancePaise: wallet.balancePaise,
      balanceRupees: wallet.balancePaise / 100,
      pricePer100Paise,
      pricePer100Rupees: pricePer100Paise / 100,
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }

  async listLedger(orgId: string, take = 50) {
    await this.ensureWallet(orgId);
    const rows = await this.prisma.walletLedgerEntry.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      amountPaise: r.amountPaise,
      balanceAfter: r.balanceAfter,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async credit(
    orgId: string,
    amountPaise: number,
    type: "topup" | "manual_credit" | "refund",
    opts?: {
      referenceType?: string;
      referenceId?: string;
      note?: string;
      createdByUserId?: string;
    },
  ) {
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw new BadRequestException("Credit amount must be positive");
    }
    return this.applyDelta(orgId, amountPaise, type, opts);
  }

  async debit(
    orgId: string,
    amountPaise: number,
    type: "sms_charge" | "manual_debit",
    opts?: {
      referenceType?: string;
      referenceId?: string;
      note?: string;
      createdByUserId?: string;
    },
  ) {
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw new BadRequestException("Debit amount must be positive");
    }
    return this.applyDelta(orgId, -amountPaise, type, opts);
  }

  private async applyDelta(
    orgId: string,
    signedAmount: number,
    type: "topup" | "sms_charge" | "manual_credit" | "manual_debit" | "refund",
    opts?: {
      referenceType?: string;
      referenceId?: string;
      note?: string;
      createdByUserId?: string;
    },
  ) {
    await this.ensureWallet(orgId);
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.organizationWallet.findUnique({
        where: { organizationId: orgId },
      });
      if (!wallet) throw new NotFoundException("Wallet not found");
      const next = wallet.balancePaise + signedAmount;
      if (next < 0) {
        throw new BadRequestException("Insufficient wallet balance");
      }
      const updated = await tx.organizationWallet.update({
        where: { organizationId: orgId },
        data: { balancePaise: next },
      });
      const entry = await tx.walletLedgerEntry.create({
        data: {
          organizationId: orgId,
          type,
          amountPaise: signedAmount,
          balanceAfter: next,
          referenceType: opts?.referenceType,
          referenceId: opts?.referenceId,
          note: opts?.note,
          createdByUserId: opts?.createdByUserId,
        },
      });
      return { balancePaise: updated.balancePaise, entry };
    });
  }

  async assertCanAffordSms(orgId: string, recipientCount: number) {
    const { estimatePaise, pricePer100Paise } = this.estimateSmsCost(recipientCount);
    const bal = await this.getBalance(orgId);
    if (estimatePaise > bal.balancePaise) {
      throw new BadRequestException(
        `Insufficient wallet balance. Need ₹${(estimatePaise / 100).toFixed(2)} for up to ${recipientCount} SMS (₹${(pricePer100Paise / 100).toFixed(2)}/100). Current balance ₹${bal.balanceRupees.toFixed(2)}.`,
      );
    }
    return { estimatePaise, pricePer100Paise, balancePaise: bal.balancePaise };
  }

  async chargeForSmsSent(
    orgId: string,
    campaignId: string,
    sentCount: number,
  ): Promise<number> {
    const pricePer100Paise = this.getSmsPricePer100Paise();
    const charge = smsChargePaise(sentCount, pricePer100Paise);
    if (charge <= 0) return 0;
    await this.debit(orgId, charge, "sms_charge", {
      referenceType: "sms_campaign",
      referenceId: campaignId,
      note: `SMS campaign ${sentCount} sent`,
    });
    return charge;
  }

  async createTopUpOrder(orgId: string, amountRupees: number) {
    const allowed = [500, 1000, 2500, 5000];
    if (!allowed.includes(amountRupees)) {
      throw new BadRequestException(
        `Top-up must be one of: ${allowed.map((a) => `₹${a}`).join(", ")}`,
      );
    }
    this.razorpay.requireConfigured();
    const amountPaise = amountRupees * 100;
    const order = await this.razorpay.createOrder({
      amountPaise,
      currency: "INR",
      receipt: `wallet_${orgId.slice(-8)}_${Date.now()}`,
      notes: {
        purpose: "wallet_topup",
        organizationId: orgId,
      },
    });
    return {
      orderId: order.id,
      amountPaise,
      amountRupees,
      currency: "INR",
      keyId: this.razorpay.keyId(),
    };
  }

  async confirmTopUp(
    orgId: string,
    input: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    this.razorpay.requireConfigured();
    const ok = this.razorpay.verifyPaymentSignature(
      input.razorpayOrderId,
      input.razorpayPaymentId,
      input.razorpaySignature,
    );
    if (!ok) throw new BadRequestException("Invalid payment signature");

    const existing = await this.prisma.walletLedgerEntry.findFirst({
      where: {
        organizationId: orgId,
        referenceType: "razorpay_order",
        referenceId: input.razorpayOrderId,
      },
    });
    if (existing) {
      const bal = await this.getBalance(orgId);
      return { ...bal, alreadyCredited: true };
    }

    const order = await this.razorpay.fetchOrder(input.razorpayOrderId);
    const amountPaise = Number(order.amount);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw new BadRequestException("Invalid order amount");
    }

    await this.credit(orgId, amountPaise, "topup", {
      referenceType: "razorpay_order",
      referenceId: input.razorpayOrderId,
      note: `Razorpay payment ${input.razorpayPaymentId}`,
    });
    return { ...(await this.getBalance(orgId)), alreadyCredited: false };
  }

  async manualAdjust(
    orgId: string,
    amountPaise: number,
    note: string,
    createdByUserId?: string,
  ) {
    if (!note?.trim()) throw new BadRequestException("Note is required");
    if (amountPaise === 0) throw new BadRequestException("Amount cannot be zero");
    if (amountPaise > 0) {
      await this.credit(orgId, amountPaise, "manual_credit", {
        note: note.trim(),
        createdByUserId,
        referenceType: "super_admin",
      });
    } else {
      await this.debit(orgId, Math.abs(amountPaise), "manual_debit", {
        note: note.trim(),
        createdByUserId,
        referenceType: "super_admin",
      });
    }
    return this.getBalance(orgId);
  }
}
