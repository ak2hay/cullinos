export type PrintProfileKind = "receipt" | "kot";

export type PrintProfile = {
  kind: PrintProfileKind;
  outletId: string;
  paperWidthMm: number;
  fontSize: "small" | "normal" | "large";
  headerText?: string;
  footerText?: string;
  showLogo: boolean;
  showTaxBreakdown: boolean;
  copies: number;
  cutPaper: boolean;
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
  showTaxBreakdown: true,
  copies: 1,
  cutPaper: true,
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
  showTaxBreakdown: false,
  copies: 1,
  cutPaper: true,
  deviceId: null,
});

export type DeviceMetadata = {
  printProfiles?: Partial<Record<PrintProfileKind, PrintProfile>>;
};
