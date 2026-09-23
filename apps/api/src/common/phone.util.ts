/** Shared staff/guest phone normalization (MSG91 / India mobile). */
export function normalizeStaffPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  // Already includes country code (e.g. +9715… → 9715…)
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return digits;
}

/** Prefer E.164 with leading + for CRM / display storage. */
export function normalizePhoneE164(phone: string, defaultDial = "91"): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+${defaultDial}${digits}`;
  return `+${digits}`;
}

/** Candidate strings that may exist in DB for the same handset. */
export function staffPhoneLookupVariants(normalized: string): string[] {
  const digits = normalized.replace(/\D/g, "");
  const variants = new Set<string>([normalized, digits]);
  if (digits.length === 12 && digits.startsWith("91")) {
    const local = digits.slice(2);
    variants.add(local);
    variants.add(`+${digits}`);
    variants.add(`+91${local}`);
    variants.add(`91 ${local}`);
  } else if (digits.length === 10) {
    variants.add(`91${digits}`);
    variants.add(`+91${digits}`);
  } else if (digits.length >= 11) {
    variants.add(`+${digits}`);
    const local = digits.slice(-10);
    variants.add(local);
  }
  return [...variants].filter((v) => v.length >= 10);
}
