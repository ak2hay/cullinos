import { Navigate, Route, Routes } from 'react-router-dom';
import { defaultPortalMode, PERMISSIONS } from '@cullinos/shared';
import { ErpAccessRoute } from '@/components/auth/ErpAccessRoute';
import { PermissionRoute } from '@/components/auth/PermissionRoute';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { BusinessTypeRoute } from '@/components/layout/BusinessTypeRoute';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { PortalPosPage } from '@/features/pos/PortalPosPage';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DeliveryPage } from '@/pages/DeliveryPage';
import { AggregatorsPage } from '@/pages/AggregatorsPage';
import { MarketplaceListingPage } from '@/pages/MarketplaceListingPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { GuestsPage } from '@/pages/GuestsPage';
import { DisplaysPage } from '@/pages/DisplaysPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { LoginPage } from '@/pages/LoginPage';
import { LoyaltyPage } from '@/pages/LoyaltyPage';
import { MenuPage } from '@/pages/MenuPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { TablesPage } from '@/pages/TablesPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { EventsPage } from '@/pages/EventsPage';
import { BanquetsPage } from '@/pages/BanquetsPage';
import { BrandsPage } from '@/pages/BrandsPage';
import { ProductionPage } from '@/pages/ProductionPage';
import { RecipesPage } from '@/pages/RecipesPage';
import { PurchasingPage } from '@/pages/PurchasingPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { CentralKitchenPage } from '@/pages/CentralKitchenPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { KioskLauncherPage } from '@/pages/KioskLauncherPage';
import { CouponsPage } from '@/pages/CouponsPage';
import { GuestBannersPage } from '@/pages/GuestBannersPage';
import { ReservationsPage } from '@/pages/ReservationsPage';
import { SmsCampaignsPage } from '@/pages/SmsCampaignsPage';
import { RoomsPage } from '@/pages/RoomsPage';
import { StaffPage } from '@/pages/StaffPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { BillingPage } from '@/pages/BillingPage';
import { useAuthStore } from '@/stores/auth';

function PublicOnly({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const permissions = useAuthStore((s) => s.permissions);
  if (accessToken) {
    return <Navigate to={defaultPortalMode(permissions) === 'pos' ? '/pos' : '/'} replace />;
  }
  return children;
}

function ErpPage({ children }: { children: React.ReactNode }) {
  return <ErpAccessRoute>{children}</ErpAccessRoute>;
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
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
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
        <Route
          index
          element={
            <ErpPage>
              <DashboardPage />
            </ErpPage>
          }
        />
        <Route
          path="pos"
          element={
            <PermissionRoute allOf={[PERMISSIONS.POS_ACCESS]} fallback="/">
              <PortalPosPage />
            </PermissionRoute>
          }
        />
        <Route
          path="menu"
          element={
            <ErpPage>
              <PermissionRoute allOf={[PERMISSIONS.MENU_READ]}>
                <MenuPage />
              </PermissionRoute>
            </ErpPage>
          }
        />
        <Route
          path="orders"
          element={
            <ErpPage>
              <PermissionRoute allOf={[PERMISSIONS.ORDER_READ]}>
                <OrdersPage />
              </PermissionRoute>
            </ErpPage>
          }
        />
        <Route
          path="tables"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <TablesPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="inventory"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <PermissionRoute allOf={[PERMISSIONS.INVENTORY_READ]}>
                  <InventoryPage />
                </PermissionRoute>
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="customers"
          element={
            <ErpPage>
              <PermissionRoute allOf={[PERMISSIONS.CUSTOMER_READ]}>
                <CustomersPage />
              </PermissionRoute>
            </ErpPage>
          }
        />
        <Route
          path="sms-campaigns"
          element={
            <ErpPage>
              <PermissionRoute allOf={[PERMISSIONS.SETTINGS_UPDATE]}>
                <SmsCampaignsPage />
              </PermissionRoute>
            </ErpPage>
          }
        />
        <Route
          path="reservations"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <ReservationsPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="coupons"
          element={
            <ErpPage>
              <PermissionRoute allOf={[PERMISSIONS.SETTINGS_UPDATE]}>
                <CouponsPage />
              </PermissionRoute>
            </ErpPage>
          }
        />
        <Route
          path="guest-banners"
          element={
            <ErpPage>
              <PermissionRoute allOf={[PERMISSIONS.SETTINGS_UPDATE]}>
                <GuestBannersPage />
              </PermissionRoute>
            </ErpPage>
          }
        />
        <Route
          path="events"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <EventsPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="banquets"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <BanquetsPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="brands"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <BrandsPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="production"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <ProductionPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        {/* Displays hub — consolidated KDS / CDS / promo launcher */}
        <Route
          path="displays"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <DisplaysPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        {/* Legacy redirects — keep old bookmarks working */}
        <Route path="kds" element={<Navigate to="/displays" replace />} />
        <Route path="cds" element={<Navigate to="/displays" replace />} />
        <Route path="promo-display" element={<Navigate to="/displays" replace />} />
        <Route path="pickup-queue" element={<Navigate to="/displays" replace />} />
        <Route
          path="loyalty"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <LoyaltyPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        {/* /kds and /cds are now redirects — see /displays above */}
        <Route
          path="kiosk"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <KioskLauncherPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="recipes"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <RecipesPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="purchasing"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <PermissionRoute allOf={[PERMISSIONS.PURCHASE_READ]}>
                  <PurchasingPage />
                </PermissionRoute>
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="suppliers"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <PermissionRoute allOf={[PERMISSIONS.PURCHASE_READ]}>
                  <SuppliersPage />
                </PermissionRoute>
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="central-kitchen"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <PermissionRoute allOf={[PERMISSIONS.INVENTORY_TRANSFER]}>
                  <CentralKitchenPage />
                </PermissionRoute>
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="delivery"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <DeliveryPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="aggregators"
          element={
            <ErpPage>
              <PermissionRoute allOf={[PERMISSIONS.REPORTS_READ]}>
                <AggregatorsPage />
              </PermissionRoute>
            </ErpPage>
          }
        />
        <Route path="payments" element={<Navigate to="/settings?tab=payments" replace />} />
        <Route
          path="marketplace"
          element={
            <ErpPage>
              <PermissionRoute anyOf={[PERMISSIONS.OUTLET_UPDATE, PERMISSIONS.SETTINGS_UPDATE]}>
                <BusinessTypeRoute>
                  <MarketplaceListingPage />
                </BusinessTypeRoute>
              </PermissionRoute>
            </ErpPage>
          }
        />
        <Route
          path="hospitality/guests"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <GuestsPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="hospitality/rooms"
          element={
            <ErpPage>
              <BusinessTypeRoute>
                <RoomsPage />
              </BusinessTypeRoute>
            </ErpPage>
          }
        />
        <Route
          path="staff"
          element={
            <ErpPage>
              <PermissionRoute allOf={[PERMISSIONS.STAFF_READ]}>
                <StaffPage />
              </PermissionRoute>
            </ErpPage>
          }
        />
        <Route
          path="reports"
          element={
            <ErpPage>
              <PermissionRoute allOf={[PERMISSIONS.REPORTS_READ]}>
                <ReportsPage />
              </PermissionRoute>
            </ErpPage>
          }
        />
        <Route
          path="settings"
          element={
            <ErpPage>
              <PermissionRoute allOf={[PERMISSIONS.SETTINGS_READ]}>
                <SettingsPage />
              </PermissionRoute>
            </ErpPage>
          }
        />
        <Route
          path="billing"
          element={
            <ErpPage>
              <PermissionRoute allOf={[PERMISSIONS.ORG_MANAGE_SETTINGS]}>
                <BillingPage />
              </PermissionRoute>
            </ErpPage>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
