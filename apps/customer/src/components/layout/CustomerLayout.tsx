import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerLoginModal } from '@/components/CustomerLoginModal';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { useStorefrontBase } from '@/hooks/useStorefrontBase';
import { useCartStore } from '@/stores/cart';
import { useCustomerAuthStore } from '@/stores/customerAuth';
import { useSessionStore } from '@/stores/session';

interface CustomerLayoutProps {
  children: React.ReactNode;
  showCart?: boolean;
}

export function CustomerLayout({ children, showCart = true }: CustomerLayoutProps) {
  const base = useStorefrontBase();
  const itemCount = useCartStore((s) => s.itemCount());
  const tableName = useSessionStore((s) => s.tableName);
  const outletName = useSessionStore((s) => s.outletName);
  const organizationName = useSessionStore((s) => s.organizationName);
  const organizationId = useSessionStore((s) => s.organizationId);
  const orderMode = useSessionStore((s) => s.orderMode);
  const customer = useCustomerAuthStore((s) => s.customer);
  const logout = useCustomerAuthStore((s) => s.logout);
  const [loginOpen, setLoginOpen] = useState(false);

  const title = outletName ?? organizationName ?? 'Cullinos';

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-bg-secondary/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <Link to={base} className="text-lg font-semibold text-brand-primary">
              {title}
            </Link>
            {orderMode === 'dine-in' && tableName ? (
              <p className="text-xs text-text-secondary">Ordering for {tableName}</p>
            ) : (
              <p className="text-xs text-text-secondary">Order online</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {customer ? (
              <>
                <Link
                  to={`${base}/loyalty`}
                  className="max-w-[7.5rem] truncate rounded-lg bg-bg-card px-3 py-2 text-xs font-medium text-text-secondary transition hover:bg-bg-elevated"
                  title={`${customer.name} · ${customer.loyaltyPoints} pts`}
                >
                  {customer.name.split(' ')[0]}
                  <span className="ml-1 text-brand-primary">{customer.loyaltyPoints} pts</span>
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="rounded-lg bg-bg-card px-2 py-2 text-xs text-text-muted transition hover:bg-bg-elevated hover:text-text-secondary"
                  title="Sign out"
                >
                  Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="rounded-lg bg-bg-card px-3 py-2 text-sm font-medium transition hover:bg-bg-elevated"
              >
                Sign in
              </button>
            )}
            {showCart ? (
              <Link
                to={`${base}/cart`}
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1">{children}</main>

      <PoweredByFooter />

      <CustomerLoginModal
        open={loginOpen}
        orgId={organizationId}
        onClose={() => setLoginOpen(false)}
      />
    </div>
  );
}
