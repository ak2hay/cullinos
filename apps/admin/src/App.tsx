import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { MenuPage } from '@/pages/MenuPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { EventsPage } from '@/pages/EventsPage';
import { ProductionPage } from '@/pages/ProductionPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { PickupQueuePage } from '@/pages/PickupQueuePage';
import { StaffPage } from '@/pages/StaffPage';
import { SettingsPage } from '@/pages/SettingsPage';
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
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <AppShell compact>
              <OnboardingWizard />
            </AppShell>
          </ProtectedRoute>
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
        <Route path="menu" element={<MenuPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route
          path="tables"
          element={<PlaceholderPage title="Tables" phase="Phase 2 — Table Management" />}
        />
        <Route
          path="inventory"
          element={<PlaceholderPage title="Inventory" phase="Phase 2 — Inventory Management" />}
        />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="production" element={<ProductionPage />} />
        <Route path="pickup-queue" element={<PickupQueuePage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
