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
  ThemeToggle,
  type CommandPaletteItem,
  type NavSectionDef,
} from '@cullinos/ui';
import { CalendarDays, LogOut, Menu, Search } from 'lucide-react';
import { organizationsApi } from '@/lib/api';
import { useOpenOrders } from '@/lib/useShellAlerts';
import { useAuthStore } from '@/stores/auth';
import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';
import { LanguageSelect, useOrgDefaultLanguage } from '@/components/LanguageSelect';
import { NotificationsBell } from './NotificationsBell';
import { OutletSelector } from './OutletSelector';
import { UpgradeCard } from './UpgradeCard';
import { NavIcon, iconForPath } from './navIcons';
import { UserAvatar, UserMenu } from './UserMenu';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function TodayChip() {
  const label = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return (
    <span className="hidden h-9 items-center gap-2 rounded-lg border border-line-subtle px-3 text-sm text-text-secondary xl:inline-flex">
      <CalendarDays size={16} className="text-text-muted" aria-hidden="true" />
      {label}
    </span>
  );
}

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
      { to: '/stations', label: 'Kitchen stations' },
      { to: '/kiosk', label: 'Digital Ordering' },
      { to: '/delivery', label: 'Delivery' },
      { to: '/aggregators', label: 'Aggregators (Coming soon)' },
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
          .filter((item) =>
            isAdminNavPathVisible(businessType, item.to, restaurantSize, org?.enabledModules),
          )
          .filter((item) => isErpNavPathAllowed(permissions, item.to))
          .filter((item) => item.to !== '/onboarding' || org?.setupCompleted !== true),
      }))
      .filter((section) => section.items.length > 0);
  }, [t, businessType, restaurantSize, org?.enabledModules, org?.setupCompleted, permissions]);

  const openOrders = useOpenOrders();
  const canSeeBilling = isErpNavPathAllowed(permissions, '/billing');

  function handleLogout() {
    logout();
    navigate('/login');
    onNavigate?.();
  }

  return (
    <>
      <div className="px-5 pb-4 pt-5">
        <BrandWordmark size="sm" />
        <p className="mt-1 text-xs font-medium text-text-muted">
          {isQsrPortalOrg(businessType) ? t('shell.qsrPortal') : t('shell.admin')}
        </p>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
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
                    `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                      isActive
                        ? 'bg-brand-primary/12 font-semibold text-brand-primary'
                        : 'text-text-secondary hover:bg-hover hover:text-text-primary'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden="true"
                        className={`absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand-primary transition-all duration-200 ${
                          isActive ? 'opacity-100' : 'scale-y-0 opacity-0'
                        }`}
                      />
                      <span
                        className={`transition-colors ${isActive ? 'text-brand-primary' : 'text-text-muted group-hover:text-text-primary'}`}
                      >
                        <NavIcon name={iconForPath(item.to)} />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.to === '/orders' && openOrders.total > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-status-error px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {openOrders.total > 99 ? '99+' : openOrders.total}
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              ))}
            </NavSection>
          );
        })}
      </nav>

      {canSeeBilling ? (
        <div className="px-3 pb-3">
          <UpgradeCard org={org} onNavigate={onNavigate} />
        </div>
      ) : null}

      <div className="border-t border-line-subtle p-4">
        <NavLink
          to="/profile"
          onClick={onNavigate}
          className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-hover"
        >
          <UserAvatar
            name={[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || ''}
            avatarUrl={user?.avatarUrl}
            size={36}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="block truncate text-xs text-text-muted">{user?.email}</span>
          </span>
        </NavLink>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            <LogOut size={15} aria-hidden="true" />
            {t('common.signOut')}
          </button>
          <LanguageSelect />
        </div>
      </div>
    </>
  );
}

function PortalModeSwitch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = useAuthStore((s) => s.permissions);
  const portalMode = useAuthStore((s) => s.portalMode);
  const setPortalMode = useAuthStore((s) => s.setPortalMode);

  const canErp = canAccessPortalMode(permissions, 'erp');
  const canPos = canAccessPortalMode(permissions, 'pos');
  // Dual-mode switch: need POS_ACCESS plus at least one ERP capability.
  if (!canPos || !canErp) return null;

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
      className="inline-flex rounded-lg border border-line bg-bg-elevated p-0.5"
      role="group"
      aria-label={t('shell.portalMode')}
    >
      <button
        type="button"
        disabled={!canErp}
        onClick={() => switchMode('erp')}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          portalMode === 'erp'
            ? 'bg-brand-primary text-on-brand'
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
            ? 'bg-brand-primary text-on-brand'
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
  const user = useAuthStore((s) => s.user);

  const { data: org } = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
  });
  useOrgDefaultLanguage(org?.language);
  const businessType = parseBusinessType(org?.businessType);
  const restaurantSize = parseRestaurantSize(org?.restaurantSize);
  const canErp = canAccessPortalMode(permissions, 'erp');
  const canPos = canAccessPortalMode(permissions, 'pos');
  const posOnly = canPos && !canErp;
  const inPosMode = !compact && canPos && (posOnly || location.pathname === '/pos');

  const visibleNavItems = useMemo(() => {
    return translateSections(t, navSections).flatMap((section) =>
      section.items
        .filter((item) =>
          isAdminNavPathVisible(businessType, item.to, restaurantSize, org?.enabledModules),
        )
        .filter((item) => isErpNavPathAllowed(permissions, item.to))
        .filter((item) => item.to !== '/onboarding' || org?.setupCompleted !== true)
        .map((item) => ({ ...item, group: section.label })),
    );
  }, [t, businessType, restaurantSize, org?.enabledModules, org?.setupCompleted, permissions]);

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
    if (compact || !canPos) return;
    if (posOnly) {
      if (portalMode !== 'pos') setPortalMode('pos');
      if (location.pathname !== '/pos' && location.pathname !== '/profile') {
        navigate('/pos', { replace: true });
      }
      return;
    }
    if (location.pathname === '/pos' && portalMode !== 'pos' && canPos) {
      setPortalMode('pos');
    } else if (location.pathname !== '/pos' && portalMode === 'pos' && canErp) {
      setPortalMode('erp');
    }
  }, [
    compact,
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

  function toggleSection(id: string) {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (inPosMode) {
    return (
      <div className="flex h-[100dvh] flex-col bg-bg-primary">
        <ImpersonationBanner />
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line-subtle bg-bg-secondary px-3 py-2 sm:h-14 sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-0">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <BrandWordmark size="sm" />
            <p className="hidden text-xs text-text-muted sm:block">
              {user?.firstName} · POS
            </p>
            <PortalModeSwitch />
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="hidden text-xs text-text-muted sm:block">{t('common.outlet')}</p>
              <OutletSelector />
            </div>
            <LanguageSelect className="hidden sm:inline-flex" />
            <ThemeToggle />
            <UserMenu />
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
        <aside className="hidden h-full min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r border-line-subtle bg-bg-secondary lg:flex">
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
              className="absolute inset-0 animate-fade-in bg-scrim backdrop-blur-[2px]"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="relative flex h-full w-[min(18rem,85vw)] animate-slide-in-left flex-col border-r border-line-subtle bg-bg-secondary shadow-xl">
              <SidebarNav
                onNavigate={() => setMobileNavOpen(false)}
                collapsedSections={collapsedSections}
                onToggleSection={toggleSection}
              />
            </aside>
          </div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line-subtle bg-bg-secondary/80 px-4 backdrop-blur-md sm:px-6">
            <button
              type="button"
              aria-label={t('shell.openNavigation')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-text-secondary transition-colors hover:bg-hover lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            {!compact ? (
              <OutletSelector />
            ) : (
              <p className="text-sm font-medium text-text-secondary">{t('shell.restaurantSetup')}</p>
            )}
            <div className="flex min-w-0 flex-1 justify-center px-2">
              {!compact ? (
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="hidden h-10 w-full max-w-md items-center gap-2.5 rounded-xl border border-line bg-bg-card px-3.5 text-sm text-text-muted shadow-sm transition-colors hover:border-line-strong hover:text-text-secondary md:inline-flex"
                >
                  <Search size={16} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {t('shell.searchPlaceholder', 'Search pages and actions…')}
                  </span>
                  <kbd className="rounded-md border border-line bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                    {IS_MAC ? '⌘ K' : 'Ctrl K'}
                  </kbd>
                </button>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!compact ? (
                <button
                  type="button"
                  aria-label={t('common.search')}
                  onClick={() => setCommandOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line-subtle text-text-secondary hover:bg-hover md:hidden"
                >
                  <Search size={18} aria-hidden="true" />
                </button>
              ) : null}
              <TodayChip />
              {!compact ? <NotificationsBell /> : null}
              <ThemeToggle />
              {!compact ? <PortalModeSwitch /> : null}
              <UserMenu />
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <div key={location.pathname.split('/')[1]} className="animate-fade-in">
              {children ?? <Outlet />}
            </div>
          </main>
        </div>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} items={commandItems} />
    </div>
  );
}
