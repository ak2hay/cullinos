import { describe, expect, it } from "vitest";
import {
  buildMsg91WhatsappBulkBody,
  isPlausibleWhatsappPhone,
  msg91WhatsappErrorMessage,
  msg91WhatsappRequestId,
  normalizeWhatsappPhone,
  sanitizeTemplateParam,
} from "./whatsapp-msg91.util";

describe("MSG91 WhatsApp payload", () => {
  it("normalizes a 10-digit Indian number", () => {
    expect(normalizeWhatsappPhone("98765 43210")).toBe("919876543210");
    expect(isPlausibleWhatsappPhone(normalizeWhatsappPhone("+91 98765 43210"))).toBe(true);
  });

  it("collapses newlines in template params", () => {
    expect(sanitizeTemplateParam("Hello\nthere")).toBe("Hello there");
  });

  it("maps body params and optional namespace", () => {
    const body = buildMsg91WhatsappBulkBody({
      integratedNumber: "919800000000",
      templateName: "cullinos_marketing",
      languageCode: "en",
      namespace: "ns_1",
      phones: ["919876543210"],
      bodyParams: ["Today only"],
    });
    expect(body).toMatchObject({
      integrated_number: "919800000000",
      content_type: "template",
      payload: {
        type: "template",
        template: {
          name: "cullinos_marketing",
          namespace: "ns_1",
          to_and_components: [
            {
              to: ["919876543210"],
              components: { body_1: { type: "text", value: "Today only" } },
            },
          ],
        },
      },
    });
  });

  it("reads MSG91 success and error shapes", () => {
    expect(msg91WhatsappRequestId({ request_id: "req_1", type: "success" })).toBe("req_1");
    expect(msg91WhatsappErrorMessage({ type: "error", message: "Template mismatch" }, 200)).toBe(
      "Template mismatch",
    );
    expect(msg91WhatsappErrorMessage({ type: "success", request_id: "req_1" }, 200)).toBeNull();
  });
});
