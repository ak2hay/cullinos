import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { MenuPage } from '@/pages/MenuPage';
import { storefrontApi } from '@/lib/api';
import { useSessionStore } from '@/stores/session';

function StorefrontBootstrap({ children }: { children: React.ReactNode }) {
  const { orgSlug, outletSlug } = useParams<{ orgSlug: string; outletSlug: string }>();
  const setStorefront = useSessionStore((s) => s.setStorefront);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['storefront', orgSlug, outletSlug],
    queryFn: () => storefrontApi.bootstrap(orgSlug!, outletSlug!),
    enabled: Boolean(orgSlug && outletSlug),
  });

  useEffect(() => {
    if (data) setStorefront(data);
  }, [data, setStorefront]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-text-secondary">
        Loading menu…
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LegacyRedirect() {
  const orgSlug = import.meta.env.VITE_ORG_SLUG ?? 'demo-restaurant';
  const outletSlug = import.meta.env.VITE_OUTLET_SLUG ?? 'main-outlet';
  return <Navigate to={`/${orgSlug}/${outletSlug}`} replace />;
}
