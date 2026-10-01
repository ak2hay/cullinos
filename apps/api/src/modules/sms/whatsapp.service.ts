import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { redactPhone } from "../../common/pii-redact.util";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import {
  MSG91_WHATSAPP_BULK_URL,
  buildMsg91WhatsappBulkBody,
  isPlausibleWhatsappPhone,
  msg91WhatsappErrorMessage,
  msg91WhatsappRequestId,
  normalizeWhatsappPhone,
  sanitizeTemplateParam,
} from "./whatsapp-msg91.util";

const MAX_RECIPIENTS = 100;

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly config: PlatformConfigService) {}

  private authKey(): string | undefined {
    return (
      this.config.get("MSG91_WHATSAPP_AUTH_KEY")?.trim() ||
      this.config.get("MSG91_AUTH_KEY")?.trim() ||
      undefined
    );
  }

  private integratedNumber(): string | undefined {
    const raw = this.config.get("MSG91_WHATSAPP_INTEGRATED_NUMBER")?.trim();
    if (!raw) return undefined;
    const digits = raw.replace(/\D/g, "");
    return digits || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.authKey() && this.integratedNumber());
  }

  /** Receipts are business-initiated, so MSG91 only delivers them as an approved template. */
  isReceiptTemplateConfigured(): boolean {
    return this.isConfigured() && Boolean(this.config.get("WHATSAPP_RECEIPT_TEMPLATE")?.trim());
  }

  private requirePhones(phones: string[]): string[] {
    const normalized = [
      ...new Set(phones.map((phone) => normalizeWhatsappPhone(phone)).filter(Boolean)),
    ];
    if (!normalized.length) {
      throw new BadRequestException("Enter at least one phone number.");
    }
    if (normalized.length > MAX_RECIPIENTS) {
      throw new BadRequestException(`Send to at most ${MAX_RECIPIENTS} numbers at a time.`);
    }
    if (normalized.some((phone) => !isPlausibleWhatsappPhone(phone))) {
      throw new BadRequestException("One or more phone numbers are invalid.");
    }
    return normalized;
  }

  /**
   * Send an approved MSG91 WhatsApp template. Body params map to body_1, body_2, …
   */
  async sendTemplate(
    phone: string | string[],
    templateName: string,
    bodyParams: string[],
  ): Promise<{ sent: boolean; messageId?: string; recipientCount: number }> {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        "WhatsApp is not configured. Add the MSG91 integrated number in Super Admin → Settings → WhatsApp.",
      );
    }
    const name = templateName.trim();
    if (!name) {
      throw new BadRequestException("WhatsApp template name is missing.");
    }
    const phones = this.requirePhones(Array.isArray(phone) ? phone : [phone]);
    const authkey = this.authKey()!;
    const integratedNumber = this.integratedNumber()!;
    const language = this.config.get("WHATSAPP_TEMPLATE_LANGUAGE")?.trim() || "en";
    const body = buildMsg91WhatsappBulkBody({
      integratedNumber,
      templateName: name,
      languageCode: language,
      namespace: this.config.get("MSG91_WHATSAPP_NAMESPACE"),
      phones,
      bodyParams,
    });

    try {
      const res = await fetch(MSG91_WHATSAPP_BULK_URL, {
        method: "POST",
        headers: {
          authkey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as unknown;
      const error = msg91WhatsappErrorMessage(data, res.status);
      if (!res.ok || error) {
        const msg = error ?? `WhatsApp API ${res.status}`;
        this.logger.error(`WhatsApp send failed: ${msg}`);
        throw new BadRequestException(msg);
      }
      return {
        sent: true,
        messageId: msg91WhatsappRequestId(data),
        recipientCount: phones.length,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(
        `WhatsApp send error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException("Failed to send WhatsApp message");
    }
  }

  /** Draft text fills body_1 of the approved marketing template. */
  async sendMarketing(
    phones: string[],
    message: string,
  ): Promise<{ sent: boolean; messageId?: string; recipientCount: number }> {
    const template = this.config.get("WHATSAPP_MARKETING_TEMPLATE")?.trim();
    if (!template) {
      throw new BadRequestException(
        "WhatsApp marketing template is not configured. Set an approved template in Super Admin → Settings → WhatsApp.",
      );
    }
    const text = sanitizeTemplateParam(message);
    if (text === "-") {
      throw new BadRequestException("Enter a message to send.");
    }
    return this.sendTemplate(phones, template, [text]);
  }

  async testConnection(
    phone: string,
    message: string,
  ): Promise<{ ok: boolean; message: string }> {
    const marketing = this.config.get("WHATSAPP_MARKETING_TEMPLATE")?.trim();
    const receipt = this.config.get("WHATSAPP_RECEIPT_TEMPLATE")?.trim();
    const template = marketing || receipt;
    if (!template) {
      throw new BadRequestException(
        "Set a marketing or e-bill WhatsApp template in Super Admin → Settings → WhatsApp before sending a test.",
      );
    }
    const text = sanitizeTemplateParam(message);
    if (text === "-") {
      throw new BadRequestException("Enter a test message.");
    }
    const params = marketing ? [text] : [text, "-", "-", "-"];
    const result = await this.sendTemplate(phone, template, params);
    const to = redactPhone(normalizeWhatsappPhone(phone));
    return {
      ok: result.sent,
      message: `Test WhatsApp sent to ${to}${result.messageId ? ` (${result.messageId})` : ""}`,
    };
  }

  async sendMarketingDraft(
    phones: string[],
    message: string,
  ): Promise<{ ok: boolean; message: string; sentCount: number }> {
    const result = await this.sendMarketing(phones, message);
    return {
      ok: result.sent,
      sentCount: result.recipientCount,
      message: `Marketing WhatsApp queued for ${result.recipientCount} number${result.recipientCount === 1 ? "" : "s"}${result.messageId ? ` (${result.messageId})` : ""}`,
    };
  }

  async sendReceiptAndThankYou(input: {
    phone: string;
    orderNumber: string;
    total: number;
    outletName?: string | null;
    feedbackUrl?: string | null;
  }): Promise<{ sent: boolean; messageId?: string }> {
    const template = this.config.get("WHATSAPP_RECEIPT_TEMPLATE")?.trim();
    if (!template) {
      throw new BadRequestException(
        "WhatsApp e-bill template is not configured. Set an approved template in Super Admin → Settings → WhatsApp.",
      );
    }
    const result = await this.sendTemplate(input.phone, template, [
      input.orderNumber,
      input.outletName?.trim() || "-",
      `₹${input.total.toFixed(2)}`,
      input.feedbackUrl || "-",
    ]);
    return { sent: result.sent, messageId: result.messageId };
  }
}
