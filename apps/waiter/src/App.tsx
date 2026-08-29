import { Navigate, Route, Routes } from 'react-router-dom';
import { MobileShell } from './components/layout/MobileShell';
import { LoginPage } from './pages/LoginPage';
import { OrderPage } from './pages/OrderPage';
import { TablesPage } from './pages/TablesPage';
import { useAuthStore } from './stores/auth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
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
        <Route path="tables/:tableId" element={<OrderPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
