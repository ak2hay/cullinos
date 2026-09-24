import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
import {
  BrandWordmark,
  CommandPalette,
  NavSection,
  type CommandPaletteItem,
  type NavSectionDef,
} from '@cullinos/ui';
import { organizationsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';
import { LanguageSelect, useOrgDefaultLanguage } from '@/components/LanguageSelect';
import { OutletSelector } from './OutletSelector';
import { NavIcon, iconForPath } from './navIcons';

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
      { to: '/reservations', label: 'Reservations' },
      { to: '/displays', label: 'Displays' },
      { to: '/kiosk', label: 'Digital Ordering' },
      { to: '/delivery', label: 'Delivery' },
      { to: '/aggregators', label: 'Aggregators' },
    ],
  },
  {
    id: 'catalog',
    label: 'Menu & catalog',
    items: [
      { to: '/menu', label: 'Menu' },
      { to: '/inventory', label: 'Inventory' },
      { to: '/recipes', label: 'Recipes' },
      { to: '/purchasing', label: 'Purchasing' },
      { to: '/suppliers', label: 'Suppliers' },
      { to: '/production', label: 'Production' },
      { to: '/central-kitchen', label: 'Central kitchen' },
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
    id: 'cullinos-app',
    label: 'Cullinos App',
    items: [
      { to: '/marketplace', label: 'App listing' },
      { to: '/coupons', label: 'Coupons & offers' },
      { to: '/guest-banners', label: 'Banners' },
      { to: '/sms-campaigns', label: 'SMS campaigns (paid)' },
    ],
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

const SECTION_LABEL_KEYS: Record<string, string> = {
  overview: 'nav.sections.overview',
  operations: 'nav.sections.operations',
  catalog: 'nav.sections.catalog',
  guests: 'nav.sections.guests',
  events: 'nav.sections.events',
  'cullinos-app': 'nav.sections.cullinosApp',
  admin: 'nav.sections.admin',
};

const NAV_LABEL_KEYS: Record<string, string> = {
  '/': 'nav.items.dashboard',
  '/orders': 'nav.items.orders',
  '/tables': 'nav.items.tables',
  '/reservations': 'nav.items.reservations',
  '/displays': 'nav.items.displays',
  '/kiosk': 'nav.items.kiosk',
  '/delivery': 'nav.items.delivery',
  '/aggregators': 'nav.items.aggregators',
  '/menu': 'nav.items.menu',
  '/inventory': 'nav.items.inventory',
  '/recipes': 'nav.items.recipes',
  '/purchasing': 'nav.items.purchasing',
  '/suppliers': 'nav.items.suppliers',
  '/production': 'nav.items.production',
  '/central-kitchen': 'nav.items.centralKitchen',
  '/brands': 'nav.items.brands',
  '/customers': 'nav.items.customers',
  '/loyalty': 'nav.items.loyalty',
  '/hospitality/guests': 'nav.items.guests',
  '/hospitality/rooms': 'nav.items.rooms',
  '/events': 'nav.items.events',
  '/banquets': 'nav.items.banquets',
  '/marketplace': 'nav.items.appListing',
  '/coupons': 'nav.items.coupons',
  '/guest-banners': 'nav.items.banners',
  '/sms-campaigns': 'nav.items.smsCampaigns',
  '/staff': 'nav.items.staff',
  '/reports': 'nav.items.reports',
  '/onboarding': 'nav.items.setup',
  '/settings': 'nav.items.settings',
  '/billing': 'nav.items.billing',
};

function translateSections(t: TFunction, sections: NavSectionDef[]): NavSectionDef[] {
  return sections.map((section) => {
    const sectionKey = SECTION_LABEL_KEYS[section.id];
    return {
      ...section,
      label: sectionKey ? t(sectionKey) : section.label,
      items: section.items.map((item) => {
        const itemKey = NAV_LABEL_KEYS[item.to];
        return itemKey ? { ...item, label: t(itemKey) } : item;
      }),
    };
  });
}

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

function SidebarNav({
  onNavigate,
  collapsedSections,
  onToggleSection,
}: {
  onNavigate?: () => void;
  collapsedSections: Record<string, boolean>;
  onToggleSection: (id: string) => void;
}) {
  const { t } = useTranslation();
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
    return translateSections(t, navSections)
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => isAdminNavPathVisible(businessType, item.to, restaurantSize))
          .filter((item) => isErpNavPathAllowed(permissions, item.to))
          .filter((item) => item.to !== '/onboarding' || org?.setupCompleted !== true),
      }))
      .filter((section) => section.items.length > 0);
  }, [t, businessType, restaurantSize, org?.setupCompleted, permissions]);

  function handleLogout() {
    logout();
    navigate('/login');
    onNavigate?.();
  }

  return (
    <>
      <div className="border-b border-white/5 p-5">
        <BrandWordmark size="sm" />
        <p className="mt-1.5 text-xs text-text-muted">
          {isQsrPortalOrg(businessType) ? t('shell.qsrPortal') : t('shell.admin')}
        </p>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {visibleSections.map((section) => {
          const open = !collapsedSections[section.id];
          return (
            <NavSection
              key={section.id}
              label={section.label}
              collapsible
              open={open}
              onToggle={() => onToggleSection(section.id)}
            >
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                      isActive
                        ? 'bg-brand-primary/15 font-medium text-brand-primary'
                        : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                    }`
                  }
                >
                  <span className="opacity-80">
                    <NavIcon name={iconForPath(item.to)} />
                  </span>
                  {item.label}
                </NavLink>
              ))}
            </NavSection>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-4">
        <p className="truncate text-sm font-medium">
          {user?.firstName} {user?.lastName}
        </p>
        <p className="truncate text-xs text-text-muted">{user?.email}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            {t('common.signOut')}
          </button>
          <LanguageSelect />
        </div>
      </div>
    </>
  );
}

function PortalModeSwitch({
  businessType,
}: {
  businessType: BusinessType | null;
}) {
  const { t } = useTranslation();
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
      aria-label={t('shell.portalMode')}
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
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
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
  useOrgDefaultLanguage(org?.language);
  const businessType = parseBusinessType(org?.businessType);
  const restaurantSize = parseRestaurantSize(org?.restaurantSize);
  const qsrPortal = isQsrPortalOrg(businessType);
  const canErp = canAccessPortalMode(permissions, 'erp');
  const canPos = canAccessPortalMode(permissions, 'pos');
  const posOnly = qsrPortal && canPos && !canErp;
  const inPosMode = !compact && qsrPortal && (posOnly || location.pathname === '/pos');

  const visibleNavItems = useMemo(() => {
    return translateSections(t, navSections).flatMap((section) =>
      section.items
        .filter((item) => isAdminNavPathVisible(businessType, item.to, restaurantSize))
        .filter((item) => isErpNavPathAllowed(permissions, item.to))
        .filter((item) => item.to !== '/onboarding' || org?.setupCompleted !== true)
        .map((item) => ({ ...item, group: section.label })),
    );
  }, [t, businessType, restaurantSize, org?.setupCompleted, permissions]);

  const commandItems: CommandPaletteItem[] = useMemo(
    () =>
      visibleNavItems.map((item) => ({
        id: item.to,
        label: item.label,
        group: item.group,
        icon: <NavIcon name={iconForPath(item.to)} />,
        onSelect: () => navigate(item.to),
      })),
    [visibleNavItems, navigate],
  );

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!inPosMode && !compact) setCommandOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inPosMode, compact]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function toggleSection(id: string) {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (inPosMode) {
    return (
      <div className="flex h-[100dvh] flex-col bg-bg-primary">
        <ImpersonationBanner />
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/5 bg-bg-secondary px-3 py-2 sm:h-14 sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-0">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <BrandWordmark size="sm" />
            <p className="hidden text-xs text-text-muted sm:block">
              {user?.firstName} · POS
            </p>
            <PortalModeSwitch businessType={businessType} />
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="hidden text-xs text-text-muted sm:block">{t('common.outlet')}</p>
              <OutletSelector />
            </div>
            <LanguageSelect className="hidden sm:inline-flex" />
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary sm:px-3 sm:text-sm"
            >
              {t('common.signOut')}
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">{children ?? <Outlet />}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-primary">
      <ImpersonationBanner />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden h-full min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r border-white/5 bg-bg-secondary/95 lg:flex">
          <SidebarNav
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
          />
        </aside>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label={t('shell.closeNavigation')}
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="relative flex h-full w-[min(18rem,85vw)] flex-col border-r border-white/5 bg-bg-secondary shadow-xl">
              <SidebarNav
                onNavigate={() => setMobileNavOpen(false)}
                collapsedSections={collapsedSections}
                onToggleSection={toggleSection}
              />
            </aside>
          </div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/5 bg-bg-secondary/40 px-4 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={t('shell.openNavigation')}
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
                  <p className="text-sm text-text-muted">{t('common.outlet')}</p>
                  <OutletSelector />
                </div>
              ) : (
                <p className="text-sm font-medium text-text-secondary">{t('shell.restaurantSetup')}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!compact ? (
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="hidden items-center gap-2 rounded-lg border border-white/10 bg-bg-elevated px-3 py-1.5 text-xs text-text-muted sm:inline-flex hover:text-text-secondary"
                >
                  <span>{t('common.search')}</span>
                  <kbd className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px]">
                    ⌘K
                  </kbd>
                </button>
              ) : null}
              {!compact ? <PortalModeSwitch businessType={businessType} /> : null}
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children ?? <Outlet />}</main>
        </div>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} items={commandItems} />
    </div>
  );
}
