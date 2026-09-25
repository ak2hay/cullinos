import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { HealthPage } from '@/pages/HealthPage';
import { LoginPage } from '@/pages/LoginPage';
import { PlansPage } from '@/pages/PlansPage';
import { PromoEmailPage } from '@/pages/PromoEmailPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';
import { TenantDetailPage } from '@/pages/TenantDetailPage';
import { TenantsPage } from '@/pages/TenantsPage';
import { LabsPage } from '@/pages/LabsPage';
import { AuditActivityPage } from '@/pages/AuditActivityPage';
import { UsersReportPage } from '@/pages/UsersReportPage';
import { BlogEditorPage } from '@/pages/marketing/BlogEditorPage';
import { DesignLabPage } from '@/pages/marketing/DesignLabPage';
import { HeroEditorPage } from '@/pages/marketing/HeroEditorPage';
import { MarketingDashboardPage } from '@/pages/marketing/MarketingDashboardPage';
import { MediaLibraryPage } from '@/pages/marketing/MediaLibraryPage';
import { NavigationEditorPage } from '@/pages/marketing/NavigationEditorPage';
import { PagesEditorPage } from '@/pages/marketing/PagesEditorPage';
import { PricingEditorPage } from '@/pages/marketing/PricingEditorPage';
import { TestimonialsEditorPage } from '@/pages/marketing/TestimonialsEditorPage';
import { ThemeEditorPage } from '@/pages/marketing/ThemeEditorPage';
import { APP_OPS_URL } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

function PublicOnly({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return (
    <p className="p-6 text-sm text-text-secondary">
      Redirecting to Cullinos App Ops…
    </p>
  );
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
        <Route index element={<DashboardPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="tenants/:id" element={<TenantDetailPage />} />
        <Route path="labs" element={<LabsPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="audit" element={<AuditActivityPage />} />
        <Route path="users-report" element={<UsersReportPage />} />
        <Route path="promo-email" element={<PromoEmailPage />} />
        <Route path="guest-ops" element={<ExternalRedirect to={APP_OPS_URL} />} />
        <Route path="guest-ops/*" element={<ExternalRedirect to={APP_OPS_URL} />} />
        <Route path="guest-banners" element={<ExternalRedirect to={`${APP_OPS_URL}/banners`} />} />
        <Route
          path="guest-push"
          element={<ExternalRedirect to={`${APP_OPS_URL}/notifications`} />}
        />
        <Route path="guest-coupons" element={<ExternalRedirect to={`${APP_OPS_URL}/offers`} />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="marketing" element={<MarketingDashboardPage />} />
        <Route path="marketing/media" element={<MediaLibraryPage />} />
        <Route path="marketing/hero" element={<HeroEditorPage />} />
        <Route path="marketing/pages" element={<PagesEditorPage />} />
        <Route path="marketing/theme" element={<ThemeEditorPage />} />
        <Route path="marketing/pricing" element={<PricingEditorPage />} />
        <Route path="marketing/testimonials" element={<TestimonialsEditorPage />} />
        <Route path="marketing/navigation" element={<NavigationEditorPage />} />
        <Route path="marketing/blog" element={<BlogEditorPage />} />
        <Route path="marketing/design-lab" element={<DesignLabPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
