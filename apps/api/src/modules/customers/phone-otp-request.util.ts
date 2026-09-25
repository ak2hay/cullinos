/** Production must not pretend SMS was delivered when MSG91 skip/fail. */
export function shouldFailPhoneOtpWhenUnsent(
  sent: boolean,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return !sent && nodeEnv === "production";
}

export const PHONE_OTP_SMS_NOT_CONFIGURED_MESSAGE =
  "SMS could not be sent. MSG91 Flow is not configured — add Auth key and Flow template ID in Platform settings (Waiter/staff phone OTP needs Flow, not Widget alone), then try again.";

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
