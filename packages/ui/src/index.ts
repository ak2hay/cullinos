export const cullinosTheme = {
  colors: {
    charcoal: "#0F0F1A",
    charcoalLight: "#1A1A2E",
    amber: "#D4A017",
    amberLight: "#E8B84A",
    white: "#FFFFFF",
    muted: "#888888",
    border: "#2A2A3E",
    success: "#22C55E",
    error: "#EF4444",
    warning: "#F59E0B",
  },
  fonts: {
    sans: "Inter, system-ui, sans-serif",
    mono: "JetBrains Mono, monospace",
  },
};

export { colors, typography, borderRadius } from './theme';

export const poweredByRkyves = "Powered by Rkyves";

export function formatOrderNumber(num: string | number): string {
  return String(num).padStart(4, "0");
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
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
      minHeight: "100vh",
      background: cullinosTheme.colors.charcoal,
      color: cullinosTheme.colors.white,
      fontFamily: cullinosTheme.fonts.sans,
      padding: "clamp(1rem, 4vw, 2rem)",
      boxSizing: "border-box" as const,
    },
    header: {
      borderBottom: `1px solid ${cullinosTheme.colors.border}`,
      paddingBottom: "1rem",
      marginBottom: "clamp(1rem, 4vw, 2rem)",
    },
    title: {
      color: cullinosTheme.colors.amber,
      margin: 0,
      fontSize: "clamp(1.5rem, 5vw, 2rem)",
    },
    subtitle: {
      color: cullinosTheme.colors.muted,
      margin: "0.5rem 0 0",
      fontSize: "clamp(0.875rem, 2.5vw, 1rem)",
    },
    card: {
      background: cullinosTheme.colors.charcoalLight,
      border: `1px solid ${cullinosTheme.colors.border}`,
      borderRadius: "12px",
      padding: "clamp(1rem, 4vw, 2rem)",
      maxWidth: "640px",
    },
    muted: {
      color: cullinosTheme.colors.muted,
      marginTop: "1rem",
      fontSize: "0.875rem",
      lineHeight: 1.6,
    },
    code: {
      fontFamily: cullinosTheme.fonts.mono,
      wordBreak: "break-all" as const,
    },
    footer: {
      marginTop: "clamp(1.5rem, 5vw, 3rem)",
      color: cullinosTheme.colors.muted,
      fontSize: "0.875rem",
    },
  };
}

export function getPortalDevShellCopy(props: PortalDevShellProps) {
  const apiHost = props.apiHost ?? "localhost:3000";
  const version = props.version ?? "0.1.0";
  return {
    statusLine: `Development shell — will connect to the Cullinos API at ${apiHost} when fully wired.`,
    versionLine: `Cullinos v${version}`,
  };
}
