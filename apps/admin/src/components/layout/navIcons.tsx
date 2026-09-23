/** Small inline nav icons — no icon library dependency. */
export function NavIcon({ name }: { name: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case 'orders':
      return (
        <svg {...common}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
      );
    case 'tables':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="8" rx="8" ry="3" />
          <path d="M4 8v4c0 1.7 3.6 3 8 3s8-1.3 8-3V8" />
          <path d="M4 12v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      );
    case 'inventory':
      return (
        <svg {...common}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M3.3 7 12 12l8.7-5M12 22V12" />
        </svg>
      );
    case 'customers':
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'staff':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-1a6 6 0 0 1 12 0v1" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16M8 17V9M12 17v-6M16 17v-3" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      );
    case 'kds':
      return (
        <svg {...common}>
          <rect x="2" y="4" width="20" height="14" rx="2" />
          <path d="M8 22h8M12 18v4" />
        </svg>
      );
    case 'delivery':
      return (
        <svg {...common}>
          <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
      );
    case 'promo':
      return (
        <svg {...common}>
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case 'default':
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}

export function iconForPath(path: string): string {
  if (path === '/') return 'dashboard';
  if (path.startsWith('/orders')) return 'orders';
  if (path.startsWith('/tables') || path.startsWith('/reservations')) return 'tables';
  if (path.startsWith('/menu') || path.startsWith('/recipes') || path.startsWith('/brands')) return 'menu';
  if (
    path.startsWith('/inventory') ||
    path.startsWith('/purchasing') ||
    path.startsWith('/suppliers') ||
    path.startsWith('/production') ||
    path.startsWith('/central-kitchen')
  )
    return 'inventory';
  if (path.startsWith('/customers') || path.startsWith('/loyalty') || path.startsWith('/hospitality'))
    return 'customers';
  if (path.startsWith('/staff')) return 'staff';
  if (path.startsWith('/reports') || path.startsWith('/billing')) return 'reports';
  if (path.startsWith('/settings') || path.startsWith('/onboarding') || path.startsWith('/payments'))
    return 'settings';
  if (path.startsWith('/kds') || path.startsWith('/cds') || path.startsWith('/kiosk') || path.startsWith('/promo-display'))
    return 'kds';
  if (path.startsWith('/delivery') || path.startsWith('/aggregators')) return 'delivery';
  if (
    path.startsWith('/coupons') ||
    path.startsWith('/guest') ||
    path.startsWith('/promo') ||
    path.startsWith('/sms') ||
    path.startsWith('/marketplace')
  )
    return 'promo';
  if (path.startsWith('/events') || path.startsWith('/banquets')) return 'calendar';
  return 'default';
}
