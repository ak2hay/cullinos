/**
 * Optional Sentry init. No-op stub for Compose deploys without @sentry/node.
 * Full implementation lives in repo when the dependency is installed.
 */
export async function initSentry(): Promise<void> {
  return;
}
