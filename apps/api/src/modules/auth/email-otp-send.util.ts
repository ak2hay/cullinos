export const EMAIL_OTP_SEND_FAILED_MESSAGE =
  "Could not send verification email. Please try again or contact support.";

/** Production must not show an OTP screen when the email never left the server. */
export function shouldFailEmailOtpWhenUnsent(
  sent: boolean,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return !sent && nodeEnv === "production";
}
