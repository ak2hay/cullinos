/** Map raw MSG91 Widget API errors to operator-friendly copy (Guest + Waiter). */
export function friendlyMsg91WidgetMessage(message?: string): string {
  const raw = (message || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) {
    return "SMS could not be sent. Please try again in a moment.";
  }
  if (lower.includes("ipblocked") || lower.includes("ip blocked")) {
    return "MSG91 blocked this network IP. Ask an admin to allow it in MSG91, or try another network.";
  }
  if (lower.includes("captcha")) {
    return "MSG91 captcha is enabled on this OTP widget. Open MSG91 dashboard > OTP Widget settings and turn OFF Captcha Validation (required for in-app SMS).";
  }
  if (lower.includes("mobile requests are not allowed")) {
    return "This MSG91 widget is web-only. Open MSG91 dashboard > OTP Widget settings and turn ON Mobile Integration for in-app SMS.";
  }
  if (lower.includes("web requests are not allowed")) {
    return "This MSG91 widget is mobile-only. Disable Mobile Integration or use the mobile send path.";
  }
  return raw;
}

/** True when MSG91-verified phone and client-supplied phone refer to the same handset. */
export function staffWidgetPhonesMatch(
  requestedNormalized: string,
  verifiedNormalized: string,
): boolean {
  const a = requestedNormalized.replace(/\D/g, "");
  const b = verifiedNormalized.replace(/\D/g, "");
  if (a.length < 10 || b.length < 10) return false;
  if (a === b) return true;
  return a.endsWith(b.slice(-10)) || b.endsWith(a.slice(-10));
}
