import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hashPassword, verifyPassword } from "@cullinos/auth";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  REFUND_PIN_INVALID_CODE,
  REFUND_PIN_LOCKED_CODE,
  REFUND_PIN_LOCK_MS,
  REFUND_PIN_NOT_SET_CODE,
  isPinLocked,
  isValidRefundPin,
  lockMinutesLeft,
  pinFailureOutcome,
} from "./refund-pin.util";

@Injectable()
export class RefundPinService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async findUser(orgId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, status: "active" },
      select: {
        id: true,
        passwordHash: true,
        refundPinHash: true,
        refundPinLockedUntil: true,
      },
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async status(orgId: string, userId: string) {
    const user = await this.findUser(orgId, userId);
    const now = new Date();
    const locked = isPinLocked(user.refundPinLockedUntil, now);
    return {
      isSet: Boolean(user.refundPinHash),
      lockedUntil: locked ? user.refundPinLockedUntil : null,
    };
  }

  async setPin(orgId: string, userId: string, currentPassword: unknown, pin: unknown) {
    if (!isValidRefundPin(pin)) {
      throw new BadRequestException("Passcode must be exactly 4 digits");
    }
    if (typeof currentPassword !== "string" || !currentPassword) {
      throw new BadRequestException("Enter your account password");
    }
    const user = await this.findUser(orgId, userId);
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new BadRequestException("Account password is incorrect");
    }
    const hadPin = Boolean(user.refundPinHash);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refundPinHash: await hashPassword(pin),
        refundPinFailedAttempts: 0,
        refundPinLockedUntil: null,
      },
    });
    await this.audit.log({
      organizationId: orgId,
      userId,
      action: "user.refund_pin_set",
      entityType: "user",
      entityId: userId,
      metadata: { changed: hadPin },
    });
    return { isSet: true };
  }

  /**
   * Check the caller's own refund passcode. Wrong attempts are counted atomically and
   * lock refunds for this user once the budget is spent.
   */
  async verify(orgId: string, userId: string, pin: unknown, context: { orderId: string }) {
    const user = await this.findUser(orgId, userId);
    if (!user.refundPinHash) {
      throw new BadRequestException({
        message: "Set your 4-digit refund passcode in Profile before refunding.",
        code: REFUND_PIN_NOT_SET_CODE,
      });
    }
    const now = new Date();
    if (user.refundPinLockedUntil && isPinLocked(user.refundPinLockedUntil, now)) {
      throw new HttpException(
        {
          message: `Too many wrong passcodes. Try again in ${lockMinutesLeft(user.refundPinLockedUntil, now)} min.`,
          code: REFUND_PIN_LOCKED_CODE,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const ok = isValidRefundPin(pin) && (await verifyPassword(pin, user.refundPinHash));
    if (ok) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refundPinFailedAttempts: 0, refundPinLockedUntil: null },
      });
      return;
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { refundPinFailedAttempts: { increment: 1 } },
      select: { refundPinFailedAttempts: true },
    });
    const outcome = pinFailureOutcome(updated.refundPinFailedAttempts);
    if (outcome.lock) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          refundPinFailedAttempts: 0,
          refundPinLockedUntil: new Date(now.getTime() + REFUND_PIN_LOCK_MS),
        },
      });
    }
    await this.audit.log({
      organizationId: orgId,
      userId,
      action: "order.refund_pin_failed",
      entityType: "order",
      entityId: context.orderId,
      metadata: { locked: outcome.lock, remaining: outcome.remaining },
    });
    if (outcome.lock) {
      throw new HttpException(
        {
          message: `Too many wrong passcodes. Refunds are locked for ${REFUND_PIN_LOCK_MS / 60_000} min.`,
          code: REFUND_PIN_LOCKED_CODE,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    throw new BadRequestException({
      message: `Wrong passcode. ${outcome.remaining} attempt${outcome.remaining === 1 ? "" : "s"} left.`,
      code: REFUND_PIN_INVALID_CODE,
    });
  }
}
