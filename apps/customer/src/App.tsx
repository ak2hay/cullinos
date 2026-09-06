import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { KioskPage } from '@/pages/KioskPage';
import { LoyaltyPortalPage } from '@/pages/LoyaltyPortalPage';
import { MenuPage } from '@/pages/MenuPage';
import { sessionsApi, storefrontApi } from '@/lib/api';
import { useSessionStore } from '@/stores/session';

function StorefrontBootstrap({ children }: { children: React.ReactNode }) {
  const { orgSlug, outletSlug } = useParams<{ orgSlug: string; outletSlug: string }>();
  const [searchParams] = useSearchParams();
  const setStorefront = useSessionStore((s) => s.setStorefront);
  const initFromSearchParams = useSessionStore((s) => s.initFromSearchParams);
  const setSession = useSessionStore((s) => s.setSession);
  const clearSession = useSessionStore((s) => s.clearSession);
  const sessionToken = searchParams.get('session');

  useEffect(() => {
    initFromSearchParams(searchParams);
  }, [searchParams, initFromSearchParams]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['storefront', orgSlug, outletSlug],
    queryFn: () => storefrontApi.bootstrap(orgSlug!, outletSlug!),
    enabled: Boolean(orgSlug && outletSlug),
  });

  const sessionQuery = useQuery({
    queryKey: ['session', sessionToken],
    queryFn: () => sessionsApi.validate(sessionToken!),
    enabled: Boolean(sessionToken),
    retry: false,
  });

  useEffect(() => {
    if (data) setStorefront(data);
  }, [data, setStorefront]);

  useEffect(() => {
    if (sessionQuery.data?.sessionActive) {
      setSession(
        sessionQuery.data.sessionToken,
        sessionQuery.data.tableId,
        sessionQuery.data.tableName,
      );
    } else if (sessionQuery.isError) {
      clearSession();
    }
  }, [sessionQuery.data, sessionQuery.isError, setSession, clearSession]);

  if (isLoading || (sessionToken && sessionQuery.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-text-secondary">
        Loading menu…
      </div>
    );
  }

  if (sessionToken && sessionQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary p-6 text-center text-status-error">
        This table ordering link has expired. Ask your waiter for a new QR code.
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary p-6 text-center text-status-error">
        Store not found. Check your ordering link.
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LegacyRedirect />} />
      <Route
        path="/:orgSlug/:outletSlug"
        element={
          <StorefrontBootstrap>
            <MenuPage />
          </StorefrontBootstrap>
        }
      />
      <Route
        path="/:orgSlug/:outletSlug/cart"
        element={
          <StorefrontBootstrap>
            <CartPage />
          </StorefrontBootstrap>
        }
      />
      <Route
        path="/:orgSlug/:outletSlug/checkout"
        element={
          <StorefrontBootstrap>
            <CheckoutPage />
          </StorefrontBootstrap>
        }
      />
      <Route
        path="/:orgSlug/:outletSlug/loyalty"
        element={
          <StorefrontBootstrap>
            <LoyaltyPortalPage />
          </StorefrontBootstrap>
        }
      />
      <Route
        path="/:orgSlug/:outletSlug/kiosk"
        element={
          <StorefrontBootstrap>
            <KioskPage />
          </StorefrontBootstrap>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LegacyRedirect() {
  const orgSlug = import.meta.env.VITE_ORG_SLUG ?? 'demo-restaurant';
  const outletSlug = import.meta.env.VITE_OUTLET_SLUG ?? 'main-outlet';
  return <Navigate to={`/${orgSlug}/${outletSlug}`} replace />;
}
