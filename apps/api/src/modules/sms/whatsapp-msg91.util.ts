/** MSG91 WhatsApp bulk template send. Business-initiated messages must use an approved template. */
export const MSG91_WHATSAPP_BULK_URL =
  "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

export function normalizeWhatsappPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/** WhatsApp template params reject raw newlines and long runs of spaces. */
export function sanitizeTemplateParam(value: string): string {
  const collapsed = value.replace(/[\r\n\t]+/g, " ").replace(/ {5,}/g, "    ").trim();
  return collapsed.slice(0, 1024) || "-";
}

export function isPlausibleWhatsappPhone(phone: string): boolean {
  return phone.length >= 10 && phone.length <= 15;
}

export function buildMsg91WhatsappBulkBody(input: {
  integratedNumber: string;
  templateName: string;
  languageCode: string;
  namespace?: string | null;
  phones: string[];
  bodyParams: string[];
}): Record<string, unknown> {
  const components: Record<string, { type: "text"; value: string }> = {};
  input.bodyParams.forEach((value, index) => {
    components[`body_${index + 1}`] = {
      type: "text",
      value: sanitizeTemplateParam(value),
    };
  });
  const template: Record<string, unknown> = {
    name: input.templateName,
    language: { code: input.languageCode || "en", policy: "deterministic" },
    to_and_components: [{ to: input.phones, components }],
  };
  const namespace = input.namespace?.trim();
  if (namespace) template.namespace = namespace;
  return {
    integrated_number: input.integratedNumber,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template,
    },
  };
}

export function msg91WhatsappErrorMessage(data: unknown, status: number): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const failed =
    row.type === "error" ||
    row.hasError === true ||
    row.status === "fail" ||
    row.status === "error";
  if (!failed && status < 400) return null;
  if (typeof row.message === "string" && row.message.trim()) return row.message.trim();
  if (typeof row.errors === "string" && row.errors.trim()) return row.errors.trim();
  if (failed || status >= 400) return `WhatsApp API ${status}`;
  return null;
}

export function msg91WhatsappRequestId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const row = data as Record<string, unknown>;
  if (typeof row.request_id === "string") return row.request_id;
  if (typeof row.data === "string" && row.data.trim()) return row.data.trim();
  if (row.data && typeof row.data === "object") {
    const nested = row.data as Record<string, unknown>;
    if (typeof nested.request_id === "string") return nested.request_id;
  }
  return undefined;
}
