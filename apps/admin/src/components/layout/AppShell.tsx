import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BUSINESS_TYPES,
  RESTAURANT_SIZES,
  canAccessPortalMode,
  isAdminNavPathVisible,
  isErpNavPathAllowed,
  isQsrPortalOrg,
  type BusinessType,
  type PortalMode,
  type RestaurantSize,
} from '@cullinos/shared';
import { NavSection, type NavSectionDef } from '@cullinos/ui';
import { CULLINOS_BRAND, organizationsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';
import { OutletSelector } from './OutletSelector';

const navSections: NavSectionDef[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', end: true }],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { to: '/orders', label: 'Orders' },
      { to: '/tables', label: 'Tables' },
      { to: '/kds', label: 'Kitchen Display' },
      { to: '/cds', label: 'Order Display' },
      { to: '/kiosk', label: 'Digital Ordering' },
      { to: '/delivery', label: 'Delivery' },
    ],
  },
  {
    id: 'catalog',
    label: 'Menu & catalog',
    items: [
      { to: '/menu', label: 'Menu' },
      { to: '/inventory', label: 'Inventory' },
      { to: '/recipes', label: 'Recipes' },
      { to: '/production', label: 'Production' },
      { to: '/brands', label: 'Brands' },
    ],
  },
  {
    id: 'guests',
    label: 'Guests & CRM',
    items: [
      { to: '/customers', label: 'Customers' },
      { to: '/loyalty', label: 'Loyalty' },
      { to: '/hospitality/guests', label: 'Guests' },
      { to: '/hospitality/rooms', label: 'Rooms' },
    ],
  },
  {
    id: 'events',
    label: 'Events',
    items: [
      { to: '/events', label: 'Events' },
      { to: '/banquets', label: 'Banquets' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [{ to: '/promo-email', label: 'Promo Email' }],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { to: '/staff', label: 'Staff' },
      { to: '/reports', label: 'Reports' },
      { to: '/onboarding', label: 'Setup' },
      { to: '/settings', label: 'Settings' },
      { to: '/billing', label: 'Billing' },
    ],
  },
];

interface AppShellProps {
  compact?: boolean;
  children?: React.ReactNode;
}

function parseRestaurantSize(value: string | null | undefined): RestaurantSize | null {
  if (!value) return null;
  return (RESTAURANT_SIZES as readonly string[]).includes(value)
    ? (value as RestaurantSize)
    : null;
}

function parseBusinessType(value: string | null | undefined): BusinessType | null {
  if (!value) return null;
  return (BUSINESS_TYPES as readonly string[]).includes(value)
    ? (value as BusinessType)
    : null;
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const logout = useAuthStore((s) => s.logout);

  const { data: org } = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
  });

  const businessType = parseBusinessType(org?.businessType);
  const restaurantSize = parseRestaurantSize(org?.restaurantSize);

  const visibleSections = useMemo(() => {
    return navSections
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => isAdminNavPathVisible(businessType, item.to, restaurantSize))
          .filter((item) => isErpNavPathAllowed(permissions, item.to))
          .filter((item) => item.to !== '/onboarding' || org?.setupCompleted !== true),
      }))
      .filter((section) => section.items.length > 0);
  }, [businessType, restaurantSize, org?.setupCompleted, permissions]);

  function handleLogout() {
    logout();
    navigate('/login');
    onNavigate?.();
  }

  return (
    <>
      <div className="border-b border-white/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary font-mono font-bold text-bg-primary">
            C
          </div>
          <div>
            <p className="font-semibold">{CULLINOS_BRAND.name}</p>
            <p className="text-xs text-text-muted">
              {isQsrPortalOrg(businessType) ? 'QSR Portal' : 'Admin'}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-3">
        {visibleSections.map((section) => (
          <NavSection key={section.id} label={section.label}>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-brand-primary/15 font-medium text-brand-primary'
                      : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </NavSection>
        ))}
      </nav>

      <div className="border-t border-white/5 p-4">
        <p className="truncate text-sm font-medium">
          {user?.firstName} {user?.lastName}
        </p>
        <p className="truncate text-xs text-text-muted">{user?.email}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 text-sm text-text-secondary hover:text-text-primary"
        >
          Sign out
        </button>
      </div>
    </>
  );
}

function PortalModeSwitch({
  businessType,
}: {
  businessType: BusinessType | null;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = useAuthStore((s) => s.permissions);
  const portalMode = useAuthStore((s) => s.portalMode);
  const setPortalMode = useAuthStore((s) => s.setPortalMode);

  if (!isQsrPortalOrg(businessType)) return null;

  const canErp = canAccessPortalMode(permissions, 'erp');
  const canPos = canAccessPortalMode(permissions, 'pos');
  if (!canErp && !canPos) return null;
  if (canErp && !canPos) return null;
  if (!canErp && canPos) return null;

  function switchMode(mode: PortalMode) {
    if (!canAccessPortalMode(permissions, mode)) return;
    setPortalMode(mode);
    if (mode === 'pos' && location.pathname !== '/pos') {
      navigate('/pos');
    } else if (mode === 'erp' && location.pathname === '/pos') {
      navigate('/');
    }
  }

  return (
    <div
      className="inline-flex rounded-lg border border-white/10 bg-bg-elevated p-0.5"
      role="group"
      aria-label="Portal mode"
    >
      <button
        type="button"
        disabled={!canErp}
        onClick={() => switchMode('erp')}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          portalMode === 'erp'
            ? 'bg-brand-primary text-bg-primary'
            : 'text-text-secondary hover:text-text-primary disabled:opacity-40'
        }`}
      >
        ERP
      </button>
      <button
        type="button"
        disabled={!canPos}
        onClick={() => switchMode('pos')}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          portalMode === 'pos'
            ? 'bg-brand-primary text-bg-primary'
            : 'text-text-secondary hover:text-text-primary disabled:opacity-40'
        }`}
      >
        POS
      </button>
    </div>
  );
}

export function AppShell({ compact, children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = useAuthStore((s) => s.permissions);
  const portalMode = useAuthStore((s) => s.portalMode);
  const setPortalMode = useAuthStore((s) => s.setPortalMode);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const { data: org } = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
  });
  const businessType = parseBusinessType(org?.businessType);
  const qsrPortal = isQsrPortalOrg(businessType);
  const canErp = canAccessPortalMode(permissions, 'erp');
  const canPos = canAccessPortalMode(permissions, 'pos');
  const posOnly = qsrPortal && canPos && !canErp;
  const inPosMode = !compact && qsrPortal && (posOnly || location.pathname === '/pos');

  useEffect(() => {
    if (compact || !qsrPortal) return;
    if (posOnly) {
      if (portalMode !== 'pos') setPortalMode('pos');
      if (location.pathname !== '/pos') navigate('/pos', { replace: true });
      return;
    }
    if (location.pathname === '/pos' && portalMode !== 'pos' && canPos) {
      setPortalMode('pos');
    } else if (location.pathname !== '/pos' && portalMode === 'pos' && canErp) {
      setPortalMode('erp');
    }
  }, [
    compact,
    qsrPortal,
    posOnly,
    portalMode,
    location.pathname,
    canPos,
    canErp,
    setPortalMode,
    navigate,
  ]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  if (inPosMode) {
    return (
      <div className="flex h-screen flex-col bg-bg-primary">
        <ImpersonationBanner />
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/5 bg-bg-secondary px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary font-mono text-sm font-bold text-bg-primary">
              C
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold">{CULLINOS_BRAND.name}</p>
              <p className="text-xs text-text-muted">
                {user?.firstName} · POS
              </p>
            </div>
            <PortalModeSwitch businessType={businessType} />
          </div>
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs text-text-muted">Outlet</p>
              <OutletSelector />
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">{children ?? <Outlet />}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <ImpersonationBanner />
      <div className="flex min-h-0 flex-1">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/5 bg-bg-secondary lg:flex">
        <SidebarNav />
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex h-full w-[min(18rem,85vw)] flex-col border-r border-white/5 bg-bg-secondary shadow-xl">
            <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-white/5 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              className="rounded-lg border border-white/10 p-2 text-text-secondary lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {!compact ? (
              <div>
                <p className="text-sm text-text-muted">Outlet</p>
                <OutletSelector />
              </div>
            ) : (
              <p className="text-sm font-medium text-text-secondary">Restaurant setup</p>
            )}
          </div>
          {!compact ? <PortalModeSwitch businessType={businessType} /> : null}
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">{children ?? <Outlet />}</main>
      </div>
      </div>
    </div>
  );
}
