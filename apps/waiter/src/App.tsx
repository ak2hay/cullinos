import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { MobileShell } from '@/components/layout/MobileShell';
import { LoginPage } from '@/pages/LoginPage';
import { OrderPage } from '@/pages/OrderPage';
import { TablesPage } from '@/pages/TablesPage';
import { useAuthStore } from '@/stores/auth';

function PublicOnly({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
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
            <MobileShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<TablesPage />} />
        <Route path="order/:tableId" element={<OrderPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
