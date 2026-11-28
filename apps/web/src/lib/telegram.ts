/**
 * Server-only Telegram Bot API helper.
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID. Never import from client components.
 */

const TELEGRAM_TIMEOUT_MS = 5_000;
const TELEGRAM_MAX_LENGTH = 4096;

export interface InquiryForTelegram {
  source?: string;
  name: string;
  business: string;
  email: string;
  phone?: string;
  city?: string;
  outlets?: string;
  plan?: string;
  message: string;
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function field(label: string, value: string | undefined, max = 200): string {
  const trimmed = value?.trim();
  return `<b>${label}:</b> ${trimmed ? escapeHtml(clip(trimmed, max)) : '—'}`;
}

/** wa.me link for a phone string, or null when it does not look like a real number. */
function whatsappLink(phone: string | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

export function formatInquiryMessage(inquiry: InquiryForTelegram): string {
  const isDeletion = inquiry.source === 'account-deletion';
  const header = isDeletion ? '🗑 <b>Account deletion request</b>' : '📩 <b>New website enquiry</b>';
  const waLink = whatsappLink(inquiry.phone);

  const lines = [
    header,
    '',
    field('Name', inquiry.name),
    field('Business', inquiry.business),
    field('Email', inquiry.email),
    field('Phone', inquiry.phone),
    ...(waLink ? [`<a href="${waLink}">Open in WhatsApp</a>`] : []),
    field('City', inquiry.city),
    field('Outlets', inquiry.outlets),
    field('Plan', inquiry.plan),
    '',
    '<b>Message:</b>',
  ];

  const head = lines.join('\n');
  // Keep the whole message under Telegram's limit; the message body gets what is left.
  const room = Math.max(200, TELEGRAM_MAX_LENGTH - head.length - 50);
  // Escape after clipping so we never cut an HTML entity in half.
  let body = escapeHtml(clip(inquiry.message.trim(), room));
  while (head.length + 1 + body.length > TELEGRAM_MAX_LENGTH && body.length > 0) {
    body = body.slice(0, Math.floor(body.length * 0.9));
  }
  return `${head}\n${body}`;
}

/** Sends an HTML message to the configured chat. Never throws; returns true when delivered. */
export async function sendTelegramMessage(html: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Telegram error bodies carry a description only; the token is never echoed.
      const detail = await res.text().catch(() => '');
      console.error(`[telegram] sendMessage failed (${res.status}): ${detail.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    const reason = err instanceof Error ? err.name : 'unknown error';
    console.error(`[telegram] sendMessage error: ${reason}`);
    return false;
  }
}
