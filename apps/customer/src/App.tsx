import { useEffect } from 'react';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { MenuPage } from './pages/MenuPage';
import { useSessionStore } from './stores/session';

function SessionInit({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const initFromSearchParams = useSessionStore((s) => s.initFromSearchParams);

  useEffect(() => {
    initFromSearchParams(searchParams);
  }, [searchParams, initFromSearchParams]);

  return <>{children}</>;
}

export default function App() {
  return (
    <SessionInit>
      <Routes>
        <Route path="/" element={<MenuPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionInit>
  );
}
