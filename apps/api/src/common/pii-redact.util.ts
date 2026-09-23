/** Redact emails/phones for application logs (DPDP minimization). */

export function redactEmail(email: string | null | undefined): string {
  if (!email?.trim()) return "[no-email]";
  const value = email.trim();
  const at = value.indexOf("@");
  if (at <= 0) return "***";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const localMask =
    local.length <= 2 ? "**" : `${local[0]}***${local[local.length - 1]}`;
  return `${localMask}@${domain}`;
}

export function redactPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return "[no-phone]";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

export function redactRecipientList(recipients: string[]): string {
  return recipients.map((r) => (r.includes("@") ? redactEmail(r) : redactPhone(r))).join(", ");
}
