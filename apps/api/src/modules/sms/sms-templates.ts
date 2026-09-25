/**
 * In-repo transactional SMS copy for Cullinos.
 *
 * MSG91 Flow templates (OTP / marketing) live in the MSG91 dashboard — not here.
 * Expected Flow variables when configuring DLT-approved templates:
 * - OTP Flow (`MSG91_TEMPLATE_ID`): pass `OTP` (and `var` alias) with the numeric code.
 *   Recommended wording: "Cullinos: Your verification code is {{OTP}}. Valid for 10 minutes."
 * - Marketing / transactional Flow (`MSG91_MARKETING_TEMPLATE_ID`): pass `MESSAGE` (aliases
 *   `message` / `var`) with the full body from these helpers. Recommended wrapper:
 *   "{{MESSAGE}}" or "Cullinos: {{MESSAGE}}" depending on DLT registration.
 * Sender ID default: CULLIN.
 */

export function smsOwnerCredentials(input: {
  companyName: string;
  email: string;
  temporaryPassword: string;
  adminUrl: string;
}): string {
  return `Cullinos: Your ${input.companyName} admin login is ready. Email: ${input.email}. Temp password: ${input.temporaryPassword}. Login: ${input.adminUrl}`;
}

export function smsPasswordReset(input: {
  organizationName: string;
  email: string;
  temporaryPassword: string;
  adminUrl: string;
}): string {
  return `Cullinos: Password reset for ${input.organizationName}. Email: ${input.email}. Temp password: ${input.temporaryPassword}. Login: ${input.adminUrl}`;
}

export function smsReservationConfirmed(input: {
  outletName: string;
  when: string;
  partySize: number;
}): string {
  return `Cullinos: Reservation confirmed at ${input.outletName} on ${input.when} for ${input.partySize}.`;
}

export function smsReservationInvite(input: {
  outletName: string;
  bookUrl: string;
}): string {
  return `Cullinos: You're invited to reserve a table at ${input.outletName}. Book here: ${input.bookUrl}`;
}

export function smsEbill(input: {
  orderNumber: string;
  total: number;
  feedbackUrl?: string | null;
}): string {
  const total = `₹${Number(input.total).toFixed(2)}`;
  const feedback = input.feedbackUrl ? ` Feedback: ${input.feedbackUrl}` : "";
  return `Cullinos #${input.orderNumber} ${total}${feedback}`;
}
