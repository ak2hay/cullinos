export const productColors = {
  brand: {
    primary: '#D4A017',
    primaryDark: '#B8860B',
    secondary: '#1A1A2E',
    accent: '#F5A623',
  },
  background: {
    primary: '#0F0F1A',
    secondary: '#1A1A2E',
    card: '#16213E',
    elevated: '#1F2937',
  },
  text: {
    primary: '#F9FAFB',
    secondary: '#9CA3AF',
    muted: '#6B7280',
  },
  border: '#2A2A3E',
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    new: '#8B5CF6',
    preparing: '#F59E0B',
    ready: '#10B981',
    served: '#6B7280',
  },
  table: {
    available: '#10B981',
    occupied: '#EF4444',
    reserved: '#F59E0B',
    cleaning: '#6B7280',
    billing: '#3B82F6',
  },
} as const;

export const platformColors = {
  brand: {
    primary: '#6B7280',
    primaryDark: '#4B5563',
    secondary: '#111827',
    accent: '#9CA3AF',
  },
  background: {
    primary: '#0A0A0F',
    secondary: '#111827',
    card: '#1F2937',
    elevated: '#374151',
  },
  text: {
    primary: '#F9FAFB',
    secondary: '#D1D5DB',
    muted: '#9CA3AF',
  },
  border: '#374151',
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    new: '#8B5CF6',
    preparing: '#F59E0B',
    ready: '#10B981',
    served: '#6B7280',
  },
  table: {
    available: '#10B981',
    occupied: '#EF4444',
    reserved: '#F59E0B',
    cleaning: '#6B7280',
    billing: '#3B82F6',
  },
} as const;

/** @deprecated Prefer productColors — kept as alias for Tailwind configs */
export const colors = productColors;

export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
} as const;

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
} as const;

export const borderRadius = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const;

export const productTheme = {
  colors: productColors,
  typography,
  spacing,
  borderRadius,
} as const;

export const platformTheme = {
  colors: platformColors,
  typography,
  spacing,
  borderRadius,
} as const;

/** Flat theme for scaffold scripts / inline styles */
export const cullinosTheme = {
  colors: {
    charcoal: productColors.background.primary,
    charcoalLight: productColors.background.secondary,
    amber: productColors.brand.primary,
    amberLight: productColors.brand.accent,
    white: '#FFFFFF',
    muted: productColors.text.muted,
    border: productColors.border,
    success: productColors.status.success,
    error: productColors.status.error,
    warning: productColors.status.warning,
  },
  fonts: {
    sans: typography.fontFamily.sans,
    mono: typography.fontFamily.mono,
  },
} as const;
