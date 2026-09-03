import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { BusinessTypeRoute } from '@/components/layout/BusinessTypeRoute';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { MenuPage } from '@/pages/MenuPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { TablesPage } from '@/pages/TablesPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { EventsPage } from '@/pages/EventsPage';
import { ProductionPage } from '@/pages/ProductionPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { PickupQueuePage } from '@/pages/PickupQueuePage';
import { StaffPage } from '@/pages/StaffPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { BillingPage } from '@/pages/BillingPage';
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
          element={
            <BusinessTypeRoute>
              <TablesPage />
            </BusinessTypeRoute>
          }
        />
        <Route
          path="inventory"
          element={
            <BusinessTypeRoute>
              <InventoryPage />
            </BusinessTypeRoute>
          }
        />
        <Route path="customers" element={<CustomersPage />} />
        <Route
          path="events"
          element={
            <BusinessTypeRoute>
              <EventsPage />
            </BusinessTypeRoute>
          }
        />
        <Route
          path="production"
          element={
            <BusinessTypeRoute>
              <ProductionPage />
            </BusinessTypeRoute>
          }
        />
        <Route
          path="pickup-queue"
          element={
            <BusinessTypeRoute>
              <PickupQueuePage />
            </BusinessTypeRoute>
          }
        />
        <Route path="staff" element={<StaffPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="billing" element={<BillingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
