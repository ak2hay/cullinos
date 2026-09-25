import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/common.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

/** Personal choice; wins over the restaurant default. */
export const LANGUAGE_STORAGE_KEY = 'cullinos.admin.language';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === value);
}

const lazyBundles = import.meta.glob<{ default: Record<string, unknown> }>(
  './locales/*/common.json',
);

async function ensureBundle(lng: LanguageCode) {
  if (i18n.hasResourceBundle(lng, 'common')) return;
  const loader = lazyBundles[`./locales/${lng}/common.json`];
  if (!loader) return;
  const mod = await loader();
  i18n.addResourceBundle(lng, 'common', mod.default, true, true);
}

export async function applyLanguage(lng: LanguageCode) {
  await ensureBundle(lng);
  await i18n.changeLanguage(lng);
  document.documentElement.lang = lng;
}

/** Explicit user pick from a language menu: persisted per browser. */
export async function chooseLanguage(lng: LanguageCode) {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  await applyLanguage(lng);
}

export function hasPersonalLanguage(): boolean {
  return isLanguageCode(localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

void i18n.use(initReactI18next).init({
  resources: { en: { common: en } },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common'],
  interpolation: { escapeValue: false },
});

const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
if (isLanguageCode(stored) && stored !== 'en') {
  void applyLanguage(stored);
}

export default i18n;
