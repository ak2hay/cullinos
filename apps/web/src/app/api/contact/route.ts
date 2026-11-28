import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { resolvePublicEmail } from '@/lib/business';
import { formatInquiryMessage, isTelegramConfigured, sendTelegramMessage } from '@/lib/telegram';
import { verifyTurnstileToken } from '@/lib/turnstile';

interface ContactPayload {
  name?: string;
  business?: string;
  email?: string;
  phone?: string;
  city?: string;
  outlets?: string;
  plan?: string;
  message?: string;
  /** Optional origin of the submission, e.g. 'account-deletion'. */
  source?: string;
  website?: string;
  'cf-turnstile-response'?: string;
}

/** Linear-time shape check: one "@", no whitespace, and a dot inside the domain. */
function isPlausibleEmail(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 254 || /\s/.test(value)) return false;
  const at = value.indexOf('@');
  if (at < 1 || at !== value.lastIndexOf('@')) return false;
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    const body = (await request.json()) as ContactPayload;

    if (body.website) {
      return NextResponse.json({ ok: true });
    }

    const turnstileOk = await verifyTurnstileToken(body['cf-turnstile-response'], ip);
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Security check failed. Please try again.' }, { status: 400 });
    }

    const { name, business, email, message } = body;

    if (!name?.trim() || !business?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 });
    }

    if (!isPlausibleEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const toEmail = resolvePublicEmail(process.env.CONTACT_TO_EMAIL);
    const fromEmail = process.env.CONTACT_FROM_EMAIL ?? 'onboarding@resend.dev';

    const text = [
      `Name: ${name}`,
      `Business: ${business}`,
      `Email: ${email}`,
      `Phone: ${body.phone ?? '—'}`,
      `City: ${body.city ?? '—'}`,
      `Outlets: ${body.outlets ?? '—'}`,
      `Plan: ${body.plan ?? '—'}`,
      '',
      'Message:',
      message,
    ].join('\n');

    const apiBase = (
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'
    ).replace(/\/$/, '');
    try {
      await fetch(`${apiBase}/public/marketing/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.INTERNAL_API_KEY
            ? { 'x-internal-key': process.env.INTERNAL_API_KEY }
            : {}),
        },
        body: JSON.stringify({
          name,
          business,
          email,
          phone: body.phone,
          city: body.city,
          outlets: body.outlets,
          plan: body.plan,
          message,
        }),
      });
    } catch (err) {
      console.error('[contact] Failed to persist inquiry:', err);
    }

    const telegramConfigured = isTelegramConfigured();

    if (!apiKey && !telegramConfigured) {
      console.log('[contact] RESEND_API_KEY not set. Submission logged:\n', text);
      return NextResponse.json({ ok: true, mode: 'logged' });
    }

    const sendEmail = async (): Promise<boolean> => {
      if (!apiKey) return false;
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: `Cullinos Website <${fromEmail}>`,
        to: [toEmail],
        replyTo: email,
        subject: `Cullinos inquiry from ${business}`,
        text,
      });
      if (result.error) {
        console.error('[contact] Resend error:', result.error);
        return false;
      }
      return true;
    };

    const sendTelegram = async (): Promise<boolean> => {
      if (!telegramConfigured) return false;
      return sendTelegramMessage(
        formatInquiryMessage({
          source: body.source,
          name,
          business,
          email,
          phone: body.phone,
          city: body.city,
          outlets: body.outlets,
          plan: body.plan,
          message,
        }),
      );
    };

    // Email and Telegram are independent: one failing must not block the other.
    const [emailResult, telegramResult] = await Promise.allSettled([sendEmail(), sendTelegram()]);
    const emailDelivered = emailResult.status === 'fulfilled' && emailResult.value;
    const telegramDelivered = telegramResult.status === 'fulfilled' && telegramResult.value;
    if (emailResult.status === 'rejected') {
      console.error('[contact] Email send threw:', emailResult.reason);
    }

    // Fail only when email is configured and failed and Telegram did not deliver either.
    // (Telegram alone failing is non-fatal: the inquiry is still saved via the API above.)
    if (apiKey && !emailDelivered && !telegramDelivered) {
      return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count += 1;
  return true;
}
