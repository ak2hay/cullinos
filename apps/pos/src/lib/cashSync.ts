export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a settle call. The same idempotency key must be reused by `run`
 * so a retry cannot create a second order or a second cash payment.
 */
export async function syncWithRetry<T>(
  run: () => Promise<T>,
  opts: {
    attempts?: number;
    delayMs?: (attempt: number) => number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const delayMs = opts.delayMs ?? ((attempt: number) => 400 * attempt);
  const sleep = opts.sleep ?? delay;
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (err) {
      last = err;
      if (attempt < attempts) await sleep(delayMs(attempt));
    }
  }
  throw last instanceof Error ? last : new Error("Order sync failed");
}
