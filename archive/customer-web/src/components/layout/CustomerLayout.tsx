import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandWordmark } from '@cullinos/ui';
import { CustomerLoginModal } from '@/components/CustomerLoginModal';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { useStorefrontBase } from '@/hooks/useStorefrontBase';
import { sessionsApi, ApiRequestError } from '@/lib/api';
import { formatPrice } from '@/lib/api';
import { useCartStore } from '@/stores/cart';
import { useCustomerAuthStore } from '@/stores/customerAuth';
import { useSessionStore } from '@/stores/session';

interface CustomerLayoutProps {
  children: React.ReactNode;
  showCart?: boolean;
  showHero?: boolean;
}

const CALL_COOLDOWN_MS = 60_000;

export function CustomerLayout({
  children,
  showCart = true,
  showHero = false,
}: CustomerLayoutProps) {
  const base = useStorefrontBase();
  const itemCount = useCartStore((s) => s.itemCount());
  const cartTotal = useCartStore((s) => s.total());
  const tableName = useSessionStore((s) => s.tableName);
  const outletName = useSessionStore((s) => s.outletName);
  const organizationName = useSessionStore((s) => s.organizationName);
  const brandName = useSessionStore((s) => s.brandName);
  const logoUrl = useSessionStore((s) => s.logoUrl);
  const coverImageUrl = useSessionStore((s) => s.coverImageUrl);
  const accentColor = useSessionStore((s) => s.accentColor);
  const organizationId = useSessionStore((s) => s.organizationId);
  const orderMode = useSessionStore((s) => s.orderMode);
  const sessionToken = useSessionStore((s) => s.sessionToken);
  const customer = useCustomerAuthStore((s) => s.customer);
  const logout = useCustomerAuthStore((s) => s.logout);
  const [loginOpen, setLoginOpen] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callMessage, setCallMessage] = useState('');
  const [callError, setCallError] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownLeftSec, setCooldownLeftSec] = useState(0);

  const title = outletName ?? organizationName ?? 'Cullinos';
  const vibe = brandName && brandName !== outletName ? brandName : 'Order fresh, fast.';
  const onCooldown = cooldownUntil != null && Date.now() < cooldownUntil;

  const themeStyle = useMemo(
    () =>
      accentColor
        ? ({ ['--color-brand-primary' as string]: accentColor } as React.CSSProperties)
        : undefined,
    [accentColor],
  );

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownLeftSec(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, cooldownUntil - Date.now());
      setCooldownLeftSec(Math.ceil(left / 1000));
      if (left <= 0) setCooldownUntil(null);
    };
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  function startCooldown(ms = CALL_COOLDOWN_MS) {
    setCooldownUntil(Date.now() + Math.max(0, ms));
  }

  async function handleCallWaiter() {
    if (!sessionToken || calling || onCooldown) return;
    setCalling(true);
    setCallError('');
    setCallMessage('');
    try {
      const result = await sessionsApi.requestWaiter(sessionToken);
      setCallMessage(
        result.reminded
          ? 'Waiter notified again — help is on the way.'
          : result.reused
            ? 'Waiter already notified — help is on the way.'
            : 'Waiter notified — help is on the way.',
      );
      startCooldown(CALL_COOLDOWN_MS);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'SERVICE_REQUEST_COOLDOWN') {
        const remaining = Number(err.details?.cooldownRemainingMs ?? CALL_COOLDOWN_MS);
        startCooldown(remaining);
        setCallError(err.message);
      } else {
        setCallError(err instanceof Error ? err.message : 'Could not call waiter');
      }
    } finally {
      setCalling(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary" style={themeStyle}>
      <header className="sticky top-0 z-10 border-b border-white/10 bg-bg-secondary/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <Link to={base} className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
              ) : null}
              <span className="truncate font-display text-lg font-semibold tracking-tight text-brand-primary">
                {title}
              </span>
            </Link>
            {orderMode === 'dine-in' && tableName ? (
              <p className="text-xs text-text-secondary">Ordering for {tableName}</p>
            ) : (
              <p className="text-xs text-text-secondary">Order online</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {sessionToken ? (
              <button
                type="button"
                onClick={() => void handleCallWaiter()}
                disabled={calling || onCooldown}
                className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-bg-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {calling
                  ? 'Calling…'
                  : onCooldown
                    ? cooldownLeftSec > 0
                      ? `Wait ${cooldownLeftSec}s`
                      : 'Notified'
                    : 'Call Waiter'}
              </button>
            ) : null}
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
        {callMessage || callError ? (
          <div className="mx-auto mt-2 max-w-lg">
            {callMessage ? (
              <p className="rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-3 py-2 text-xs text-brand-primary">
                {callMessage}
              </p>
            ) : null}
            {callError ? (
              <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-xs text-status-error">
                {callError}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      {showHero ? (
        <section className="relative mx-auto w-full max-w-lg overflow-hidden">
          <div
            className="relative min-h-[160px] bg-bg-secondary"
            style={
              coverImageUrl
                ? {
                    backgroundImage: `linear-gradient(to top, rgba(15,15,26,0.92), rgba(15,15,26,0.35)), url(${coverImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            {!coverImageUrl ? (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(212,160,23,0.25),_transparent_55%)]" />
            ) : null}
            <div className="relative flex min-h-[160px] flex-col justify-end gap-2 px-4 py-6">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-12 w-12 rounded-xl border border-white/10 object-cover shadow-md"
                />
              ) : (
                <BrandWordmark size="sm" showMark={false} className="text-brand-primary" />
              )}
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">
                {title}
              </h1>
              <p className="max-w-sm text-sm text-text-secondary">{vibe}</p>
            </div>
          </div>
        </section>
      ) : null}

      <main className={`mx-auto w-full max-w-lg flex-1 ${showCart && itemCount > 0 ? 'pb-24' : ''}`}>
        {children}
      </main>

      {showCart && itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-bg-secondary/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-lg">
            <Link
              to={`${base}/cart`}
              className="flex h-14 items-center justify-between rounded-2xl bg-brand-primary px-5 text-sm font-bold text-bg-primary transition active:scale-[0.99]"
            >
              <span>
                View cart · {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
              <span className="font-mono">{formatPrice(cartTotal)}</span>
            </Link>
          </div>
        </div>
      ) : null}

      <PoweredByFooter />

      <CustomerLoginModal
        open={loginOpen}
        orgId={organizationId}
        onClose={() => setLoginOpen(false)}
      />
    </div>
  );
}
