import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { KitchenDisplayPage } from '@/pages/KitchenDisplayPage';
import { LoginPage } from '@/pages/LoginPage';
import { PickupDisplayPage } from '@/pages/PickupDisplayPage';
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
  // Pickup mode is a public customer-facing display — no login needed.
  const mode = getQueryParam('mode');
  const outletId = getQueryParam('outletId');

  if (mode === 'pickup' && outletId) {
    return <PickupDisplayPage outletId={outletId} />;
  }

  return (
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
  );
}
