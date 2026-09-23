/** India GST preset tax groups for restaurants (idempotent ensure). */
export type PresetRate = { name: string; rate: number; type: string };

export type TaxPreset = {
  name: string;
  isInclusive: boolean;
  rates: PresetRate[];
};

export const INDIA_TAX_PRESETS: TaxPreset[] = [
  {
    name: "Restaurant (5%)",
    isInclusive: false,
    rates: [
      { name: "CGST", rate: 2.5, type: "CGST" },
      { name: "SGST", rate: 2.5, type: "SGST" },
    ],
  },
  {
    name: "Hotel restaurant (room tariff ≥₹7,500) (18%)",
    isInclusive: false,
    rates: [
      { name: "CGST", rate: 9, type: "CGST" },
      { name: "SGST", rate: 9, type: "SGST" },
    ],
  },
  {
    name: "Packaged food (18%)",
    isInclusive: false,
    rates: [
      { name: "CGST", rate: 9, type: "CGST" },
      { name: "SGST", rate: 9, type: "SGST" },
    ],
  },
  {
    name: "Catering (18%)",
    isInclusive: false,
    rates: [
      { name: "CGST", rate: 9, type: "CGST" },
      { name: "SGST", rate: 9, type: "SGST" },
    ],
  },
  {
    name: "Nil / GST-exempt (0%)",
    isInclusive: false,
    rates: [
      { name: "CGST", rate: 0, type: "CGST" },
      { name: "SGST", rate: 0, type: "SGST" },
    ],
  },
  {
    name: "State Excise (alcohol)",
    isInclusive: false,
    rates: [{ name: "State Excise", rate: 0, type: "EXCISE" }],
  },
];

export const ALLOWED_TAX_RATE_TYPES = new Set([
  "CGST",
  "SGST",
  "IGST",
  "EXCISE",
]);
