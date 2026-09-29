import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalGate } from '@/components/PortalGate';
import { KitchenDisplayPage } from '@/pages/KitchenDisplayPage';
import { LoginPage } from '@/pages/LoginPage';
import { PickupDisplayPage } from '@/pages/PickupDisplayPage';
import { PromoPlaylistPage } from '@/pages/PromoPlaylistPage';
import { ReceiptPrintPage } from '@/pages/ReceiptPrintPage';
import { useAuthStore } from '@/stores/auth';

function PublicOnly({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) {
    return <Navigate to="/" replace />;
  }
  return children;
}

/** Read query params from the initial page load URL. */
function getQueryParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

export default function App() {
  // Pickup / CDS modes use storefront slugs. Receipt mode requires auth + outletId.
  const mode = getQueryParam('mode');
  const outletId = getQueryParam('outletId');
  const orgSlug = getQueryParam('orgSlug');
  const outletSlug = getQueryParam('outletSlug');

  if (mode === 'playlist' && orgSlug && outletSlug) {
    return (
      <PortalGate>
        <PromoPlaylistPage orgSlug={orgSlug} outletSlug={outletSlug} />
      </PortalGate>
    );
  }

  if ((mode === 'pickup' || mode === 'cds') && orgSlug && outletSlug) {
    return (
      <PortalGate>
        <PickupDisplayPage orgSlug={orgSlug} outletSlug={outletSlug} mode={mode} />
      </PortalGate>
    );
  }

  if (mode === 'receipt' && outletId) {
    return (
      <PortalGate>
        <ReceiptPrintPage outletId={outletId} />
      </PortalGate>
    );
  }

  return (
    <PortalGate>
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <KitchenDisplayPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </PortalGate>
  );
}
