import { Resend } from 'resend';
import { NextResponse } from 'next/server';

interface ContactPayload {
  name?: string;
  business?: string;
  email?: string;
  phone?: string;
  city?: string;
  outlets?: string;
  plan?: string;
  message?: string;
  website?: string;
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

    const { name, business, email, message } = body;

    if (!name?.trim() || !business?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.CONTACT_TO_EMAIL ?? 'hello@rkyves.com';
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

    if (!apiKey) {
      console.log('[contact] RESEND_API_KEY not set. Submission logged:\n', text);
      return NextResponse.json({ ok: true, mode: 'logged' });
    }

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
