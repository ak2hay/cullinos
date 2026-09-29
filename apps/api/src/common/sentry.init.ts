import type * as SentryNode from "@sentry/node";

type SentryModule = typeof SentryNode;

let sentry: SentryModule | null = null;

const SENSITIVE_HEADER = /^(authorization|cookie|set-cookie|x-api-key|x-internal-api-key|x-razorpay-signature|x-webhook-signature|x-device-token|cf-turnstile-response)$/i;
const SENSITIVE_QUERY = /([?&](?:token|access_token|refresh_token|otp|code|password|signature|key)=)[^&#]*/gi;

type ScrubbableEvent = {
  request?: {
    headers?: Record<string, string>;
    cookies?: unknown;
    data?: unknown;
    query_string?: unknown;
    url?: string;
  };
  user?: Record<string, unknown>;
};

/** Strip credentials, bodies and personal data before an event leaves the process. */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  const req = event.request;
  if (req) {
    delete req.cookies;
    // Bodies carry phone numbers, OTPs, passwords and payment payloads.
    delete req.data;
    if (req.headers) {
      for (const name of Object.keys(req.headers)) {
        if (SENSITIVE_HEADER.test(name)) req.headers[name] = "[Filtered]";
      }
    }
    if (typeof req.query_string === "string") {
      req.query_string = req.query_string.replace(/((?:^|&)(?:token|access_token|refresh_token|otp|code|password|signature|key)=)[^&]*/gi, "$1[Filtered]");
    } else if (req.query_string) {
      delete req.query_string;
    }
    if (req.url) req.url = req.url.replace(SENSITIVE_QUERY, "$1[Filtered]");
  }
  if (event.user) {
    const id = event.user.id;
    event.user = id === undefined ? {} : { id };
  }
  return event;
}

/**
 * Optional Sentry init (free tier). No-op when SENTRY_DSN is unset.
 */
export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "production",
    release: process.env.GIT_COMMIT && process.env.GIT_COMMIT !== "unknown" ? process.env.GIT_COMMIT : undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
    sendDefaultPii: false,
    enabled: true,
    beforeSend: (event) => scrubSentryEvent(event),
    beforeSendTransaction: (event) => scrubSentryEvent(event),
  });
  sentry = Sentry;
}

export function captureException(
  error: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
  if (!sentry) return;
  sentry.captureException(error, { tags: context?.tags, extra: context?.extra });
}
