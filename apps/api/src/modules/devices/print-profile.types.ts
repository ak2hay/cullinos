export type PrintProfileKind = "receipt" | "kot";

export type PrintProfile = {
  kind: PrintProfileKind;
  outletId: string;
  paperWidthMm: number;
  fontSize: "small" | "normal" | "large";
  headerText?: string;
  footerText?: string;
  showLogo: boolean;
  /** Absolute or CDN URL for receipt logo when showLogo is true */
  logoUrl?: string | null;
  showTaxBreakdown: boolean;
  copies: number;
  cutPaper: boolean;
  /** When false, POS skips auto-print for this kind */
  enabled: boolean;
  /** Optional registered printer device to target */
  deviceId?: string | null;
};

export const DEFAULT_RECEIPT_PROFILE = (
  outletId: string,
): PrintProfile => ({
  kind: "receipt",
  outletId,
  paperWidthMm: 80,
  fontSize: "normal",
  headerText: "",
  footerText: "Thank you!",
  showLogo: false,
  logoUrl: null,
  showTaxBreakdown: true,
  copies: 1,
  cutPaper: true,
  enabled: true,
  deviceId: null,
});

export const DEFAULT_KOT_PROFILE = (outletId: string): PrintProfile => ({
  kind: "kot",
  outletId,
  paperWidthMm: 80,
  fontSize: "large",
  headerText: "KITCHEN",
  footerText: "",
  showLogo: false,
  logoUrl: null,
  showTaxBreakdown: false,
  copies: 1,
  cutPaper: true,
  /** Browser KOT print off by default — use KDS screen; enable in Settings if needed */
  enabled: false,
  deviceId: null,
});

export type DeviceMetadata = {
  printProfiles?: Partial<Record<PrintProfileKind, PrintProfile>>;
};
