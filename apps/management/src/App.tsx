import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { ComparisonPage } from '@/pages/ComparisonPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { FranchisePage } from '@/pages/FranchisePage';
import { LoginPage } from '@/pages/LoginPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { StockTransferPage } from '@/pages/StockTransferPage';
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
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="comparison" element={<ComparisonPage />} />
        <Route path="stock-transfer" element={<StockTransferPage />} />
        <Route path="franchise" element={<FranchisePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
