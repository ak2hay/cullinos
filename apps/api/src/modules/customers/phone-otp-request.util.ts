/** Production must not pretend SMS was delivered when MSG91 skip/fail. */
export function shouldFailPhoneOtpWhenUnsent(
  sent: boolean,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return !sent && nodeEnv === "production";
}

export const PHONE_OTP_SMS_UNAVAILABLE_MESSAGE =
  "SMS could not be sent. Phone OTP is not configured on the server yet — add MSG91 in Platform settings, then try again.";
