import { Link } from 'react-router-dom';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { useCartStore } from '@/stores/cart';
import { useSessionStore } from '@/stores/session';

interface CustomerLayoutProps {
  children: React.ReactNode;
  showCart?: boolean;
}

export function CustomerLayout({ children, showCart = true }: CustomerLayoutProps) {
  const itemCount = useCartStore((s) => s.itemCount());
  const tableName = useSessionStore((s) => s.tableName);
  const orderMode = useSessionStore((s) => s.orderMode);

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-bg-secondary/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <Link to="/" className="text-lg font-semibold text-brand-primary">
              Menu
            </Link>
            {orderMode === 'dine-in' && tableName ? (
              <p className="text-xs text-text-secondary">{tableName}</p>
            ) : (
              <p className="text-xs text-text-secondary">Order online</p>
            )}
          </div>
          {showCart ? (
            <Link
              to="/cart"
              className="relative flex h-10 items-center rounded-lg bg-bg-card px-3 text-sm font-medium transition hover:bg-bg-elevated"
            >
              Cart
              {itemCount > 0 ? (
                <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1 text-xs font-bold text-bg-primary">
                  {itemCount}
                </span>
              ) : null}
            </Link>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1">{children}</main>

      <PoweredByFooter />
    </div>
  );
}
