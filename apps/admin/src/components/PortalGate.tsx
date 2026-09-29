import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { portalApi } from '@/lib/api';
import { usePortalStore } from '@/stores/portal';

const RECHECK_MS = 60_000;

/** Shows a full-screen notice instead of the app while the portal is off or in maintenance. */
export function PortalGate({ children }: { children: ReactNode }) {
  const disabledMessage = usePortalStore((s) => s.disabledMessage);
  const maintenanceMessage = usePortalStore((s) => s.maintenanceMessage);
  const setDisabled = usePortalStore((s) => s.setDisabled);
  const setMaintenance = usePortalStore((s) => s.setMaintenance);
  const clearBlocks = usePortalStore((s) => s.clearBlocks);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const status = await portalApi.status();
      const entry = status.portals.admin;
      if (!entry?.enabled) {
        setDisabled(status.message);
        return;
      }
      if (entry.maintenanceMessage) {
        setMaintenance(entry.maintenanceMessage);
        return;
      }
      clearBlocks();
    } catch {
      // Status probe failing should not lock users out; API calls still enforce the switch.
    } finally {
      setChecking(false);
    }
  }, [setDisabled, setMaintenance, clearBlocks]);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), RECHECK_MS);
    return () => window.clearInterval(id);
  }, [check]);

  if (maintenanceMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-950/40 p-6 text-text-primary">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-amber-500/30 bg-bg-card p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">Maintenance</p>
          <h1 className="text-xl font-semibold">Admin portal is under maintenance</h1>
          <p className="text-sm text-text-secondary">{maintenanceMessage}</p>
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

  if (!disabledMessage) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-6 text-text-primary">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">Admin portal is turned off</h1>
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
