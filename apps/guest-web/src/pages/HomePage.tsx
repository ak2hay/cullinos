import { BrandWordmark } from '@cullinos/ui';
import { AppBanner } from '@/components/AppBanner';

export function HomePage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <AppBanner />
      <main className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-16 text-center">
        <BrandWordmark size="lg" />
        <h1 className="font-display text-3xl font-bold">Scan the QR at your table</h1>
        <p className="text-text-secondary">
          The code on your table or counter opens this restaurant&apos;s menu so you can order in the
          browser. Pay the staff when the food arrives.
        </p>
      </main>
    </div>
  );
}
