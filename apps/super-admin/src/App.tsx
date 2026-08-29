import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { HealthPage } from '@/pages/HealthPage';
import { LoginPage } from '@/pages/LoginPage';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';
import { TenantsPage } from '@/pages/TenantsPage';
import { BlogEditorPage } from '@/pages/marketing/BlogEditorPage';
import { DesignLabPage } from '@/pages/marketing/DesignLabPage';
import { HeroEditorPage } from '@/pages/marketing/HeroEditorPage';
import { MarketingDashboardPage } from '@/pages/marketing/MarketingDashboardPage';
import { MediaLibraryPage } from '@/pages/marketing/MediaLibraryPage';
import { NavigationEditorPage } from '@/pages/marketing/NavigationEditorPage';
import { PagesEditorPage } from '@/pages/marketing/PagesEditorPage';
import { PricingEditorPage } from '@/pages/marketing/PricingEditorPage';
import { ThemeEditorPage } from '@/pages/marketing/ThemeEditorPage';
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
        <Route index element={<TenantsPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="marketing" element={<MarketingDashboardPage />} />
        <Route path="marketing/media" element={<MediaLibraryPage />} />
        <Route path="marketing/hero" element={<HeroEditorPage />} />
        <Route path="marketing/pages" element={<PagesEditorPage />} />
        <Route path="marketing/theme" element={<ThemeEditorPage />} />
        <Route path="marketing/pricing" element={<PricingEditorPage />} />
        <Route path="marketing/navigation" element={<NavigationEditorPage />} />
        <Route path="marketing/blog" element={<BlogEditorPage />} />
        <Route path="marketing/design-lab" element={<DesignLabPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
