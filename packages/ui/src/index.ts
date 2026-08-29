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

export const poweredByRkyves = "Powered by Rkyves";

export function formatOrderNumber(num: string | number): string {
  return String(num).padStart(4, "0");
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
}
