import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RequirePermission } from '@/components/auth/RequirePermission';
import { AppShell } from '@/components/layout/AppShell';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
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
import { TeamPage } from '@/pages/TeamPage';
import { LabsPage } from '@/pages/LabsPage';
import { AuditActivityPage } from '@/pages/AuditActivityPage';
import { UsersReportPage } from '@/pages/UsersReportPage';
import { BlogEditorPage } from '@/pages/marketing/BlogEditorPage';
import { DesignLabPage } from '@/pages/marketing/DesignLabPage';
import { HeroEditorPage } from '@/pages/marketing/HeroEditorPage';
import { InquiriesPage } from '@/pages/marketing/InquiriesPage';
import { MarketingDashboardPage } from '@/pages/marketing/MarketingDashboardPage';
import { MediaLibraryPage } from '@/pages/marketing/MediaLibraryPage';
import { NavigationEditorPage } from '@/pages/marketing/NavigationEditorPage';
import { PagesEditorPage } from '@/pages/marketing/PagesEditorPage';
import { PricingEditorPage } from '@/pages/marketing/PricingEditorPage';
import { TestimonialsEditorPage } from '@/pages/marketing/TestimonialsEditorPage';
import { ThemeEditorPage } from '@/pages/marketing/ThemeEditorPage';
import { APP_OPS_URL } from '@/lib/api';
import type { PlatformPermission } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';

function gated(permission: PlatformPermission, element: React.ReactNode) {
  return <RequirePermission permission={permission}>{element}</RequirePermission>;
}

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
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
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
        <Route index element={gated('dashboard.read', <DashboardPage />)} />
        <Route path="tenants" element={gated('tenants.read', <TenantsPage />)} />
        <Route path="tenants/:id" element={gated('tenants.read', <TenantDetailPage />)} />
        <Route path="labs" element={gated('labs.sql', <LabsPage />)} />
        <Route path="plans" element={gated('plans.read', <PlansPage />)} />
        <Route
          path="subscriptions"
          element={gated('subscriptions.manage', <SubscriptionsPage />)}
        />
        <Route path="audit" element={gated('audit.read', <AuditActivityPage />)} />
        <Route path="users-report" element={gated('tenants.read', <UsersReportPage />)} />
        <Route path="promo-email" element={gated('promo.send', <PromoEmailPage />)} />
        <Route path="team" element={gated('team.manage', <TeamPage />)} />
        <Route path="guest-ops" element={<ExternalRedirect to={APP_OPS_URL} />} />
        <Route path="guest-ops/*" element={<ExternalRedirect to={APP_OPS_URL} />} />
        <Route path="guest-banners" element={<ExternalRedirect to={`${APP_OPS_URL}/banners`} />} />
        <Route
          path="guest-push"
          element={<ExternalRedirect to={`${APP_OPS_URL}/notifications`} />}
        />
        <Route path="guest-coupons" element={<ExternalRedirect to={APP_OPS_URL} />} />
        <Route path="settings" element={gated('settings.manage', <SettingsPage />)} />
        <Route path="health" element={gated('health.read', <HealthPage />)} />
        <Route path="marketing" element={gated('marketing.manage', <MarketingDashboardPage />)} />
        <Route
          path="marketing/inquiries"
          element={gated('marketing.inquiries', <InquiriesPage />)}
        />
        <Route path="marketing/media" element={gated('marketing.manage', <MediaLibraryPage />)} />
        <Route path="marketing/hero" element={gated('marketing.manage', <HeroEditorPage />)} />
        <Route path="marketing/pages" element={gated('marketing.manage', <PagesEditorPage />)} />
        <Route path="marketing/theme" element={gated('marketing.manage', <ThemeEditorPage />)} />
        <Route
          path="marketing/pricing"
          element={gated('marketing.manage', <PricingEditorPage />)}
        />
        <Route
          path="marketing/testimonials"
          element={gated('marketing.manage', <TestimonialsEditorPage />)}
        />
        <Route
          path="marketing/navigation"
          element={gated('marketing.manage', <NavigationEditorPage />)}
        />
        <Route path="marketing/blog" element={gated('marketing.manage', <BlogEditorPage />)} />
        <Route
          path="marketing/design-lab"
          element={gated('marketing.manage', <DesignLabPage />)}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
