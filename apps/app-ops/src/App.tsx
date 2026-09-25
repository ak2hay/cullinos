import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalGate } from '@/components/PortalGate';
import { AppShell } from '@/components/layout/AppShell';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { LoginPage } from '@/pages/LoginPage';
import { GuestOpsAnalyticsPage } from '@/pages/guest-ops/AnalyticsPage';
import { GuestOpsBannersPage } from '@/pages/guest-ops/BannersPage';
import { GuestOpsDiscoverPage } from '@/pages/guest-ops/DiscoverPage';
import { GuestOpsMarketplacePage } from '@/pages/guest-ops/MarketplacePage';
import { GuestOpsOffersPage } from '@/pages/guest-ops/OffersPage';
import { GuestOpsOverviewPage } from '@/pages/guest-ops/OverviewPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { GuestOpsReviewsPage } from '@/pages/guest-ops/ReviewsPage';
import { GuestOpsRuntimePage } from '@/pages/guest-ops/RuntimePage';
import { GuestOpsUsersPage } from '@/pages/guest-ops/UsersPage';
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
        path="/forgot-password"
        element={
          <PublicOnly>
            <ForgotPasswordPage />
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
        <Route index element={<GuestOpsOverviewPage />} />
        <Route path="users" element={<GuestOpsUsersPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="push" element={<Navigate to="/notifications" replace />} />
        <Route path="banners" element={<GuestOpsBannersPage />} />
        <Route path="offers" element={<GuestOpsOffersPage />} />
        <Route path="marketplace" element={<GuestOpsMarketplacePage />} />
        <Route path="discover" element={<GuestOpsDiscoverPage />} />
        <Route path="reviews" element={<GuestOpsReviewsPage />} />
        <Route path="analytics" element={<GuestOpsAnalyticsPage />} />
        <Route path="runtime" element={<GuestOpsRuntimePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </PortalGate>
  );
}
