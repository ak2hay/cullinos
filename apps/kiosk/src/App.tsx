import { Route, Routes } from 'react-router-dom';
import { BrandWordmark } from '@cullinos/ui';
import { KioskPage } from '@/pages/KioskPage';

function KioskHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <BrandWordmark size="lg" />
      <h1 className="text-2xl font-bold">Self-order kiosk</h1>
      <p className="max-w-md text-text-secondary">
        Open the kiosk link for your outlet from Admin → Digital Ordering. It looks like
        <span className="mt-2 block font-mono text-sm text-brand-primary">
          kiosk.cullinos.com/o/your-restaurant/your-outlet
        </span>
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/o/:orgSlug/:outletSlug" element={<KioskPage />} />
      <Route path="/o/:orgSlug/:outletSlug/kiosk" element={<KioskPage />} />
      <Route path="*" element={<KioskHome />} />
    </Routes>
  );
}
