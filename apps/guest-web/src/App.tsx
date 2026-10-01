import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { MenuPage } from '@/pages/MenuPage';

const RESERVED = new Set(['o', 'assets', 'src']);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/o/:orgSlug/:outletSlug" element={<MenuPage />} />
      <Route path="/:orgSlug/:outletSlug" element={<LegacyStorefrontRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LegacyStorefrontRedirect() {
  const { orgSlug = '', outletSlug = '' } = useParams();
  const [search] = useSearchParams();
  if (!orgSlug || !outletSlug || RESERVED.has(orgSlug) || orgSlug.startsWith('.')) {
    return <Navigate to="/" replace />;
  }
  const qs = search.toString();
  return (
    <Navigate
      to={`/o/${encodeURIComponent(orgSlug)}/${encodeURIComponent(outletSlug)}${qs ? `?${qs}` : ''}`}
      replace
    />
  );
}
