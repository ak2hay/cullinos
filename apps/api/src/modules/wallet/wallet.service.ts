import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import { RazorpayClient } from "../payments/razorpay.client";

const DEFAULT_SMS_PRICE_PER_100_PAISE = 10_000; // ₹100 / 100 SMS
const DEFAULT_WHATSAPP_PRICE_PER_100_PAISE = 10_000; // ₹100 / 100 WhatsApp msgs

export function smsChargePaise(sentCount: number, pricePer100Paise: number): number {
  if (sentCount <= 0 || pricePer100Paise <= 0) return 0;
  return Math.round((sentCount * pricePer100Paise) / 100);
}

/** Same pro-rata formula as SMS; kept as alias for call-site clarity. */
export const whatsappChargePaise = smsChargePaise;

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED = "^{}\\[~]|€\f";

/**
 * Billable SMS parts for one message: GSM-7 is 160 chars (153 per part when split),
 * anything else (e.g. ₹, Devanagari) is UCS-2 at 70 (67 per part).
 */
export function smsSegments(message: string): number {
  let septets = 0;
  let gsm = true;
  for (const ch of message) {
    if (GSM7_BASIC.includes(ch)) septets += 1;
    else if (GSM7_EXTENDED.includes(ch)) septets += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) return septets <= 160 ? 1 : Math.ceil(septets / 153);
  const units = [...message].reduce((n, ch) => n + (ch.codePointAt(0)! > 0xffff ? 2 : 1), 0);
  return units <= 70 ? 1 : Math.ceil(units / 67);
}

export type WalletReservation = {
  entryId: string;
  amountPaise: number;
  type: "sms_charge" | "whatsapp_charge";
};

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

  getWhatsappPricePer100Paise(): number {
    const raw = this.config.get("WHATSAPP_PRICE_PER_100_PAISE");
    const n = raw ? Number(raw) : DEFAULT_WHATSAPP_PRICE_PER_100_PAISE;
    return Number.isFinite(n) && n >= 0
      ? Math.floor(n)
      : DEFAULT_WHATSAPP_PRICE_PER_100_PAISE;
  }

  /** `recipientCount` is billable SMS parts (recipients × segments). */
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

  estimateWhatsappCost(recipientCount: number): {
    pricePer100Paise: number;
    estimatePaise: number;
  } {
    const pricePer100Paise = this.getWhatsappPricePer100Paise();
    return {
      pricePer100Paise,
      estimatePaise: whatsappChargePaise(recipientCount, pricePer100Paise),
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
    const whatsappPricePer100Paise = this.getWhatsappPricePer100Paise();
    return {
      balancePaise: wallet.balancePaise,
      balanceRupees: wallet.balancePaise / 100,
      pricePer100Paise,
      pricePer100Rupees: pricePer100Paise / 100,
      whatsappPricePer100Paise,
      whatsappPricePer100Rupees: whatsappPricePer100Paise / 100,
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
      /** Deterministic ledger id: a second credit for the same reference fails with P2002. */
      entryId?: string;
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
    type: "sms_charge" | "whatsapp_charge" | "manual_debit",
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
    type:
      | "topup"
      | "sms_charge"
      | "whatsapp_charge"
      | "manual_credit"
      | "manual_debit"
      | "refund",
    opts?: {
      entryId?: string;
      referenceType?: string;
      referenceId?: string;
      note?: string;
      createdByUserId?: string;
    },
  ) {
    await this.ensureWallet(orgId);
    return this.prisma.$transaction(async (tx) => {
      // Conditional increment so concurrent debits can't overdraw or lose updates.
      const applied = await tx.organizationWallet.updateMany({
        where: {
          organizationId: orgId,
          ...(signedAmount < 0 ? { balancePaise: { gte: -signedAmount } } : {}),
        },
        data: { balancePaise: { increment: signedAmount } },
      });
      if (applied.count === 0) {
        const exists = await tx.organizationWallet.count({ where: { organizationId: orgId } });
        if (!exists) throw new NotFoundException("Wallet not found");
        throw new BadRequestException("Insufficient wallet balance");
      }
      const updated = await tx.organizationWallet.findUniqueOrThrow({
        where: { organizationId: orgId },
      });
      const entry = await tx.walletLedgerEntry.create({
        data: {
          ...(opts?.entryId ? { id: opts.entryId } : {}),
          organizationId: orgId,
          type,
          amountPaise: signedAmount,
          balanceAfter: updated.balancePaise,
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

  async assertCanAffordWhatsapp(orgId: string, recipientCount: number) {
    const { estimatePaise, pricePer100Paise } = this.estimateWhatsappCost(recipientCount);
    const bal = await this.getBalance(orgId);
    if (estimatePaise > bal.balancePaise) {
      throw new BadRequestException(
        `Insufficient wallet balance. Need ₹${(estimatePaise / 100).toFixed(2)} for up to ${recipientCount} WhatsApp message(s) (₹${(pricePer100Paise / 100).toFixed(2)}/100). Current balance ₹${bal.balanceRupees.toFixed(2)}. Top up under Billing.`,
      );
    }
    return { estimatePaise, pricePer100Paise, balancePaise: bal.balancePaise };
  }

  /**
   * Debits the full cost of `units` messages before sending, so concurrent sends can't
   * overdraw the wallet. Throws "Insufficient wallet balance" when it can't be covered.
   * Returns null when the price is zero (nothing to reserve).
   */
  async reserveCharge(
    orgId: string,
    channel: "sms" | "whatsapp",
    units: number,
    opts: { referenceType: string; referenceId: string; note: string },
  ): Promise<WalletReservation | null> {
    const price =
      channel === "sms" ? this.getSmsPricePer100Paise() : this.getWhatsappPricePer100Paise();
    const amountPaise = smsChargePaise(units, price);
    if (amountPaise <= 0) return null;
    const type = channel === "sms" ? "sms_charge" : "whatsapp_charge";
    const { entry } = await this.debit(orgId, amountPaise, type, opts);
    return { entryId: entry.id, amountPaise, type };
  }

  /**
   * Returns the unused part of a reservation after sending: `usedUnits` of `reservedUnits`
   * were delivered. Idempotent per reservation.
   */
  async settleReservation(
    orgId: string,
    reservation: WalletReservation | null,
    reservedUnits: number,
    usedUnits: number,
  ): Promise<number> {
    if (!reservation) return 0;
    const used = Math.min(Math.max(usedUnits, 0), reservedUnits);
    const keep = reservedUnits > 0 ? Math.round((reservation.amountPaise * used) / reservedUnits) : 0;
    const refund = reservation.amountPaise - keep;
    if (refund <= 0) return keep;
    try {
      await this.credit(orgId, refund, "refund", {
        entryId: `refund_${reservation.entryId}`,
        referenceType: "wallet_reservation",
        referenceId: reservation.entryId,
        note: `Unused ${reservation.type === "sms_charge" ? "SMS" : "WhatsApp"} credits returned`,
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
        throw err;
      }
    }
    return keep;
  }

  async createTopUpOrder(orgId: string, amountRupees: number) {
    const amount = Math.floor(Number(amountRupees));
    if (!Number.isFinite(amount) || amount !== amountRupees) {
      throw new BadRequestException("Top-up amount must be a whole number of rupees");
    }
    if (amount < 100 || amount > 50_000) {
      throw new BadRequestException("Top-up must be between ₹100 and ₹50,000");
    }
    this.razorpay.requireConfigured();
    const amountPaise = amount * 100;
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
      amountRupees: amount,
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
    if (order.notes.purpose !== "wallet_topup" || order.notes.organizationId !== orgId) {
      throw new BadRequestException("Top-up order does not belong to this organization");
    }
    if (order.status !== "paid") {
      throw new BadRequestException("Payment not captured yet — try again in a moment");
    }
    if (order.currency && order.currency.toUpperCase() !== "INR") {
      throw new BadRequestException("Payment currency mismatch");
    }
    const amountPaise = Number(order.amount);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw new BadRequestException("Invalid order amount");
    }

    try {
      await this.credit(orgId, amountPaise, "topup", {
        entryId: `topup_${input.razorpayOrderId}`,
        referenceType: "razorpay_order",
        referenceId: input.razorpayOrderId,
        note: `Razorpay payment ${input.razorpayPaymentId}`,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { ...(await this.getBalance(orgId)), alreadyCredited: true };
      }
      throw err;
    }
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
