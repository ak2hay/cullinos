import { useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RequireOwner, RequirePermission } from '@/components/auth/RequirePermission';
import { AppShell } from '@/components/layout/AppShell';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { HealthPage } from '@/pages/HealthPage';
import { LoginPage } from '@/pages/LoginPage';
import { PlansPage } from '@/pages/PlansPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { PromoEmailPage } from '@/pages/PromoEmailPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';
import { TenantDetailPage } from '@/pages/tenants/TenantDetailPage';
import { TenantsPage } from '@/pages/tenants/TenantsPage';
import { EmployeesPage } from '@/pages/employees/EmployeesPage';
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
import { AccessReviewDetailPage, MyReviewsPage } from '@/pages/access/AccessReviewDetailPage';
import { AccessReviewsPage } from '@/pages/access/AccessReviewsPage';
import { SecurityPolicyPage } from '@/pages/access/SecurityPolicyPage';
import { SessionsPage } from '@/pages/access/SessionsPage';
import { ApprovalDetailPage } from '@/pages/approvals/ApprovalDetailPage';
import { EmailApprovalPage } from '@/pages/approvals/EmailApprovalPage';
import { ApprovalPoliciesPage } from '@/pages/approvals/ApprovalPoliciesPage';
import { ApprovalsInboxPage } from '@/pages/approvals/ApprovalsInboxPage';
import { AssignmentsPage } from '@/pages/iam/AssignmentsPage';
import { OrgStructurePage } from '@/pages/iam/OrgStructurePage';
import { RolesPage } from '@/pages/iam/RolesPage';
import { StaffActivityPage } from '@/pages/iam/StaffActivityPage';
import { DirectoryPage } from '@/pages/people/DirectoryPage';
import { EmployeeProfilePage } from '@/pages/people/EmployeeProfilePage';
import { OrgChartPage } from '@/pages/people/OrgChartPage';
import { JobsPage } from '@/pages/reports/JobsPage';
import { APP_OPS_URL, SUPPORT_PORTAL_URL } from '@/lib/api';
import type { PlatformPermission } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';

function gated(permission: PlatformPermission | readonly PlatformPermission[], element: React.ReactNode) {
  return <RequirePermission permission={permission}>{element}</RequirePermission>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function ExternalRedirect({ to, label = 'Cullinos App Ops' }: { to: string; label?: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return (
    <p className="p-6 text-sm text-text-secondary">
      Redirecting to {label}…
    </p>
  );
}

function SupportTicketRedirect() {
  const { id = '' } = useParams();
  return <ExternalRedirect to={`${SUPPORT_PORTAL_URL}/agent/tickets/${encodeURIComponent(id)}`} label="the support portal" />;
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
      <Route path="/approvals/email-action" element={<EmailApprovalPage />} />
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
        <Route path="profile" element={<ProfilePage />} />
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
        <Route path="employees" element={gated('team.manage', <EmployeesPage />)} />
        <Route path="team" element={<Navigate to="/employees" replace />} />
        <Route path="reports" element={<ExternalRedirect to={`${SUPPORT_PORTAL_URL}/agent/dashboard`} label="the support portal" />} />
        <Route path="reports/jobs" element={gated(['reports.export', 'bulk.run'], <JobsPage />)} />
        <Route path="approvals" element={<ApprovalsInboxPage />} />
        <Route
          path="approvals/policies"
          element={gated(['approvals.policies', 'approvals.read_all'], <ApprovalPoliciesPage />)}
        />
        <Route path="approvals/:id" element={<ApprovalDetailPage />} />
        <Route path="support/tickets" element={<ExternalRedirect to={`${SUPPORT_PORTAL_URL}/agent/queue/open`} label="the support portal" />} />
        <Route path="support/tickets/:id" element={<SupportTicketRedirect />} />
        <Route path="support/grants" element={<ExternalRedirect to={`${SUPPORT_PORTAL_URL}/agent/grants`} label="the support portal" />} />
        <Route path="people" element={gated('directory.read', <DirectoryPage />)} />
        <Route path="people/org-chart" element={gated('directory.read', <OrgChartPage />)} />
        <Route path="people/shifts" element={<ExternalRedirect to={`${SUPPORT_PORTAL_URL}/agent/shifts`} label="the support portal" />} />
        <Route path="people/:userId" element={gated('directory.read', <EmployeeProfilePage />)} />
        <Route path="iam/org" element={gated(['iam.read', 'directory.read'], <OrgStructurePage />)} />
        <Route path="iam/roles" element={gated(['iam.read', 'iam.assign'], <RolesPage />)} />
        <Route
          path="iam/assignments"
          element={
            <RequireOwner>
              <AssignmentsPage />
            </RequireOwner>
          }
        />
        <Route path="activity" element={gated('activity.read', <StaffActivityPage />)} />
        <Route path="access/reviews" element={gated('access_reviews.manage', <AccessReviewsPage />)} />
        <Route path="access/reviews/:id" element={<AccessReviewDetailPage />} />
        <Route path="access/my-reviews" element={<MyReviewsPage />} />
        <Route path="access/sessions" element={gated('sessions.manage', <SessionsPage />)} />
        <Route path="access/security" element={gated('security.manage', <SecurityPolicyPage />)} />
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
