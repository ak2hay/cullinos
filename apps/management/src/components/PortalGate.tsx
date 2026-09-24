import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { portalApi } from '@/lib/api';
import { usePortalStore } from '@/stores/portal';

const RECHECK_MS = 60_000;

/** Shows a full-screen notice instead of the app while super admin has Management switched off. */
export function PortalGate({ children }: { children: ReactNode }) {
  const disabledMessage = usePortalStore((s) => s.disabledMessage);
  const setDisabled = usePortalStore((s) => s.setDisabled);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const status = await portalApi.status();
      setDisabled(status.portals.management.enabled ? null : status.message);
    } catch {
      // Status probe failing should not lock users out; API calls still enforce the switch.
    } finally {
      setChecking(false);
    }
  }, [setDisabled]);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), RECHECK_MS);
    return () => window.clearInterval(id);
  }, [check]);

  if (!disabledMessage) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-6 text-text-primary">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">Management portal is turned off</h1>
        <p className="text-sm text-text-secondary">{disabledMessage}</p>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking}
          className="inline-flex h-11 items-center rounded-lg bg-brand-primary px-5 text-sm font-medium text-bg-primary disabled:opacity-60"
        >
          {checking ? 'Checking…' : 'Check again'}
        </button>
      </div>
    </div>
  );
}
