import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { canAccessPortalMode, type PortalMode } from '@cullinos/shared';
import { useAuthStore } from '@/stores/auth';

export function PortalModeSwitch({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = useAuthStore((s) => s.permissions);
  const portalMode = useAuthStore((s) => s.portalMode);
  const setPortalMode = useAuthStore((s) => s.setPortalMode);

  const canErp = canAccessPortalMode(permissions, 'erp');
  const canPos = canAccessPortalMode(permissions, 'pos');
  // Dual-mode switch: need POS_ACCESS plus at least one ERP capability.
  if (!canPos || !canErp) return null;

  function switchMode(mode: PortalMode) {
    if (!canAccessPortalMode(permissions, mode)) return;
    setPortalMode(mode);
    if (mode === 'pos' && location.pathname !== '/pos') {
      navigate('/pos');
    } else if (mode === 'erp' && location.pathname === '/pos') {
      navigate('/');
    }
  }

  return (
    <div
      className={`inline-flex rounded-lg border border-line bg-bg-elevated p-0.5 ${className}`}
      role="group"
      aria-label={t('shell.portalMode')}
    >
      <button
        type="button"
        disabled={!canErp}
        onClick={() => switchMode('erp')}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          portalMode === 'erp'
            ? 'bg-brand-primary text-on-brand'
            : 'text-text-secondary hover:text-text-primary disabled:opacity-40'
        }`}
      >
        ERP
      </button>
      <button
        type="button"
        disabled={!canPos}
        onClick={() => switchMode('pos')}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          portalMode === 'pos'
            ? 'bg-brand-primary text-on-brand'
            : 'text-text-secondary hover:text-text-primary disabled:opacity-40'
        }`}
      >
        POS
      </button>
    </div>
  );
}
