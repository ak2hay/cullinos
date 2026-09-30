import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PlatformConfigService } from "../platform-config/platform-config.service";

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly config: PlatformConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get("WHATSAPP_ACCESS_TOKEN")?.trim() &&
        this.config.get("WHATSAPP_PHONE_NUMBER_ID")?.trim(),
    );
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  /** Receipts are business-initiated, so Meta only delivers them as an approved template. */
  isReceiptTemplateConfigured(): boolean {
    return this.isConfigured() && Boolean(this.config.get("WHATSAPP_RECEIPT_TEMPLATE")?.trim());
  }

  /**
   * Send a free-form text message. Meta only delivers these inside a 24h customer-initiated
   * session; use `sendTemplate` for anything the business starts.
   */
  async sendText(phone: string, body: string): Promise<{ sent: boolean; messageId?: string }> {
    return this.post(phone, { type: "text", text: { preview_url: false, body } });
  }

  async sendTemplate(
    phone: string,
    templateName: string,
    bodyParams: string[],
  ): Promise<{ sent: boolean; messageId?: string }> {
    const language = this.config.get("WHATSAPP_TEMPLATE_LANGUAGE")?.trim() || "en";
    return this.post(phone, {
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components: [
          {
            type: "body",
            parameters: bodyParams.map((text) => ({ type: "text", text: text || "-" })),
          },
        ],
      },
    });
  }

  private async post(
    phone: string,
    message: Record<string, unknown>,
  ): Promise<{ sent: boolean; messageId?: string }> {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        "WhatsApp is not configured. Add keys in Super Admin → Settings → WhatsApp.",
      );
    }
    const token = this.config.get("WHATSAPP_ACCESS_TOKEN")!.trim();
    const phoneNumberId = this.config.get("WHATSAPP_PHONE_NUMBER_ID")!.trim();
    const version = this.config.get("WHATSAPP_API_VERSION")?.trim() || "v21.0";
    const to = this.normalizePhone(phone);

    try {
      const res = await fetch(
        `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messaging_product: "whatsapp", to, ...message }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };
      if (!res.ok) {
        const msg = data.error?.message ?? `WhatsApp API ${res.status}`;
        this.logger.error(`WhatsApp send failed: ${msg}`);
        throw new BadRequestException(msg);
      }
      return { sent: true, messageId: data.messages?.[0]?.id };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(
        `WhatsApp send error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException("Failed to send WhatsApp message");
    }
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
    return this.sendTemplate(input.phone, template, [
      input.orderNumber,
      input.outletName?.trim() || "-",
      `₹${input.total.toFixed(2)}`,
      input.feedbackUrl || "-",
    ]);
  }
}
