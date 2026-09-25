export {
  colors,
  productColors,
  platformColors,
  typography,
  spacing,
  borderRadius,
  elevation,
  motion,
  brandStrategy,
  productTheme,
  platformTheme,
  cullinosTheme,
} from './theme';

export { cn } from './utils';

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './components/Button';
export { Field, controlClassName, fieldId, type FieldProps } from './components/Field';
export { Input, type InputProps } from './components/Input';
export { PasswordInput, type PasswordInputProps } from './components/PasswordInput';
export {
  PhoneField,
  DIAL_CODES,
  DEFAULT_DIAL_CODE,
  parsePhoneValue,
  composePhone,
  isoToFlag,
  type PhoneFieldProps,
  type DialCodeOption,
} from './components/PhoneField';
export {
  Turnstile,
  isTurnstileEnabled,
  type TurnstileProps,
} from './components/Turnstile';
export { Select, type SelectProps, type SelectOption } from './components/Select';
export { Textarea, type TextareaProps } from './components/Textarea';
export { Alert, ErrorBanner, type AlertProps, type AlertVariant } from './components/Alert';
export {
  ToastProvider,
  useToast,
  type ToastItem,
  type ToastVariant,
} from './components/Toast';
export { PageHeader, type PageHeaderProps } from './components/PageHeader';
export { PageShell, type PageShellProps } from './components/PageShell';
export { EmptyState } from './components/EmptyState';
export {
  DataTable,
  type DataTableProps,
  type DataTableColumn,
} from './components/DataTable';
export {
  NavSection,
  type NavSectionDef,
  type NavSectionItem,
} from './components/NavSection';
export { BrandWordmark, type BrandWordmarkProps } from './components/BrandWordmark';
export { Card, CardHeader, type CardProps } from './components/Card';
export { Badge, type BadgeProps, type BadgeVariant } from './components/Badge';
export { Tabs, TabPanel, type TabsProps, type TabItem } from './components/Tabs';
export { Dialog, type DialogProps } from './components/Dialog';
export { Drawer, type DrawerProps } from './components/Drawer';
export {
  CommandPalette,
  type CommandPaletteProps,
  type CommandPaletteItem,
} from './components/CommandPalette';

export const poweredByRkyves = 'Powered by Rkyves';

export function formatOrderNumber(num: string | number): string {
  return String(num).padStart(4, '0');
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
}

export interface PortalDevShellProps {
  title: string;
  subtitle: string;
  apiHost?: string;
  version?: string;
  footer?: string;
}

/** Responsive styles for local development placeholder screens. */
export function portalDevShellStyles() {
  return {
    page: {
      minHeight: '100vh',
      background: '#0F0F1A',
      color: '#FFFFFF',
      fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif",
      padding: 'clamp(1rem, 4vw, 2rem)',
      boxSizing: 'border-box' as const,
    },
    header: {
      borderBottom: '1px solid #2A2A3E',
      paddingBottom: '1rem',
      marginBottom: 'clamp(1rem, 4vw, 2rem)',
    },
    title: {
      color: '#D4A017',
      margin: 0,
      fontSize: 'clamp(1.5rem, 5vw, 2rem)',
    },
    subtitle: {
      color: '#6B7280',
      margin: '0.5rem 0 0',
      fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
    },
    card: {
      background: '#1A1A2E',
      border: '1px solid #2A2A3E',
      borderRadius: '12px',
      padding: 'clamp(1rem, 4vw, 2rem)',
      maxWidth: '640px',
    },
    muted: {
      color: '#6B7280',
      marginTop: '1rem',
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    code: {
      fontFamily: 'JetBrains Mono, monospace',
      wordBreak: 'break-all' as const,
    },
    footer: {
      marginTop: 'clamp(1.5rem, 5vw, 3rem)',
      color: '#6B7280',
      fontSize: '0.875rem',
    },
  };
}

export function getPortalDevShellCopy(props: PortalDevShellProps) {
  const apiHost = props.apiHost ?? 'localhost:3000';
  const version = props.version ?? '0.1.0';
  return {
    statusLine: `Development shell — will connect to the Cullinos API at ${apiHost} when fully wired.`,
    versionLine: `Cullinos v${version}`,
  };
}
