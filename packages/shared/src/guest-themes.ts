/** Named guest-app restaurant theme presets (Phase I). */
export const GUEST_THEME_PRESET_KEYS = [
  'classic',
  'forest',
  'ocean',
  'spice',
  'charcoal',
  'sunset',
] as const;

export type GuestThemePresetKey = (typeof GUEST_THEME_PRESET_KEYS)[number];

export type GuestThemePreset = {
  key: GuestThemePresetKey;
  label: string;
  description: string;
  /** Main brand / CTA color */
  primary: string;
  /** Soft tint for chips, washes */
  soft: string;
  /** Deep shade for text-on-soft / emphasis */
  deep: string;
  /** Brighter accent for gradients / secondary */
  bright: string;
};

export const GUEST_THEME_PRESETS: Record<GuestThemePresetKey, GuestThemePreset> =
  {
    classic: {
      key: 'classic',
      label: 'Classic',
      description: 'Cullinos forest green (default)',
      primary: '#006D5B',
      soft: '#E6F4F1',
      deep: '#004D40',
      bright: '#0A8A74',
    },
    forest: {
      key: 'forest',
      label: 'Forest',
      description: 'Deep woodland green',
      primary: '#2D6A4F',
      soft: '#E8F5EF',
      deep: '#1B4332',
      bright: '#40916C',
    },
    ocean: {
      key: 'ocean',
      label: 'Ocean',
      description: 'Coastal blue',
      primary: '#0369A1',
      soft: '#E0F2FE',
      deep: '#0C4A6E',
      bright: '#0EA5E9',
    },
    spice: {
      key: 'spice',
      label: 'Spice',
      description: 'Warm curry amber',
      primary: '#C2410C',
      soft: '#FFEDD5',
      deep: '#7C2D12',
      bright: '#EA580C',
    },
    charcoal: {
      key: 'charcoal',
      label: 'Charcoal',
      description: 'Modern slate',
      primary: '#334155',
      soft: '#F1F5F9',
      deep: '#0F172A',
      bright: '#475569',
    },
    sunset: {
      key: 'sunset',
      label: 'Sunset',
      description: 'Soft rose dusk',
      primary: '#BE123C',
      soft: '#FFE4E6',
      deep: '#881337',
      bright: '#E11D48',
    },
  };

export const GUEST_THEME_PRESET_LIST: GuestThemePreset[] =
  GUEST_THEME_PRESET_KEYS.map((k) => GUEST_THEME_PRESETS[k]);

export const DEFAULT_GUEST_THEME_KEY: GuestThemePresetKey = 'classic';

export function isGuestThemePresetKey(
  value: string | null | undefined,
): value is GuestThemePresetKey {
  return (
    typeof value === 'string' &&
    (GUEST_THEME_PRESET_KEYS as readonly string[]).includes(value)
  );
}

export function resolveGuestThemePreset(
  key: string | null | undefined,
): GuestThemePreset {
  if (isGuestThemePresetKey(key)) return GUEST_THEME_PRESETS[key];
  return GUEST_THEME_PRESETS[DEFAULT_GUEST_THEME_KEY];
}

/** Platform config key for default guest restaurant theme. */
export const PLATFORM_DEFAULT_GUEST_THEME_KEY =
  'PLATFORM_DEFAULT_GUEST_THEME_KEY' as const;
