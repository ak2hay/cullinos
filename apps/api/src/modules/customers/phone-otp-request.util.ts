import { HttpException, HttpStatus, UnauthorizedException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";

export type PhoneOtpPurpose = "customer_login" | "staff_login" | "staff_widget_binding";

export const PHONE_OTP_MAX_ATTEMPTS = 5;
export const PHONE_OTP_PER_PHONE_PER_HOUR = 5;
export const PHONE_OTP_PER_PHONE_ALL_ORGS_PER_HOUR = 10;
export const PHONE_OTP_PER_ORG_PER_HOUR = 300;

/** SMS OTP is only sent to Indian mobiles (91 + 10 digits starting 6-9) to limit SMS pumping. */
export function isIndianMobile(normalized: string): boolean {
  return /^91[6-9]\d{9}$/.test(normalized);
}

/** Durable (DB-backed) send limits so SMS pumping survives restarts and multiple replicas. */
export async function assertPhoneOtpSendAllowed(
  prisma: Pick<PrismaService, "phoneOtp">,
  input: { phone: string; organizationId: string },
): Promise<void> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [perPhone, perPhoneAllOrgs, perOrg] = await Promise.all([
    prisma.phoneOtp.count({
      where: { phone: input.phone, organizationId: input.organizationId, createdAt: { gte: since } },
    }),
    prisma.phoneOtp.count({ where: { phone: input.phone, createdAt: { gte: since } } }),
    prisma.phoneOtp.count({
      where: { organizationId: input.organizationId, createdAt: { gte: since } },
    }),
  ]);
  if (
    perPhone >= PHONE_OTP_PER_PHONE_PER_HOUR ||
    perPhoneAllOrgs >= PHONE_OTP_PER_PHONE_ALL_ORGS_PER_HOUR ||
    perOrg >= PHONE_OTP_PER_ORG_PER_HOUR
  ) {
    throw new HttpException(
      "Too many OTP requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * Verify and consume an OTP challenge. Attempt counting and consumption are conditional
 * updates so parallel guesses cannot exceed PHONE_OTP_MAX_ATTEMPTS or double-consume.
 */
export async function consumePhoneOtpChallenge(
  prisma: Pick<PrismaService, "phoneOtp">,
  input: {
    challengeToken: string;
    codeHash: string;
    purpose: PhoneOtpPurpose;
  },
) {
  const challenge = await prisma.phoneOtp.findFirst({
    where: { challengeToken: input.challengeToken, purpose: input.purpose },
  });
  if (!challenge || challenge.consumedAt) {
    throw new UnauthorizedException("Invalid or expired OTP");
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedException("OTP expired");
  }
  if (challenge.attempts >= PHONE_OTP_MAX_ATTEMPTS) {
    throw new UnauthorizedException("Too many attempts");
  }

  const live = {
    id: challenge.id,
    consumedAt: null,
    attempts: { lt: PHONE_OTP_MAX_ATTEMPTS },
  };
  if (challenge.codeHash !== input.codeHash) {
    await prisma.phoneOtp.updateMany({ where: live, data: { attempts: { increment: 1 } } });
    throw new UnauthorizedException("Invalid OTP");
  }
  const claimed = await prisma.phoneOtp.updateMany({
    where: live,
    data: { consumedAt: new Date() },
  });
  if (claimed.count !== 1) {
    throw new UnauthorizedException("Invalid or expired OTP");
  }
  return challenge;
}

/** Production must not pretend SMS was delivered when MSG91 skip/fail. */
export function shouldFailPhoneOtpWhenUnsent(
  sent: boolean,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return !sent && nodeEnv === "production";
}

export const PHONE_OTP_SMS_NOT_CONFIGURED_MESSAGE =
  "SMS could not be sent. MSG91 Flow is not configured — add Auth key and Flow template ID in Platform settings, or use Widget OTP (Auth key + Widget ID + tokenAuth) for Waiter/Guest, then try again.";

export const PHONE_OTP_SMS_PROVIDER_FAILED_MESSAGE =
  "SMS could not be sent. MSG91 Flow is configured but the provider rejected the send — check template, sender ID, DLT, and wallet, then try again.";

/** @deprecated Prefer PHONE_OTP_SMS_NOT_CONFIGURED_MESSAGE / PHONE_OTP_SMS_PROVIDER_FAILED_MESSAGE */
export const PHONE_OTP_SMS_UNAVAILABLE_MESSAGE = PHONE_OTP_SMS_NOT_CONFIGURED_MESSAGE;

export type PhoneOtpSendFailureKind = "not_configured" | "provider_failed";

export function phoneOtpSmsFailureMessage(
  kind: PhoneOtpSendFailureKind | undefined,
): string {
  return kind === "provider_failed"
    ? PHONE_OTP_SMS_PROVIDER_FAILED_MESSAGE
    : PHONE_OTP_SMS_NOT_CONFIGURED_MESSAGE;
}
