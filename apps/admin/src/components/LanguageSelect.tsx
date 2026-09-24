import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  applyLanguage,
  chooseLanguage,
  hasPersonalLanguage,
  isLanguageCode,
} from '@/i18n';

export function LanguageSelect({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const current = isLanguageCode(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en';

  return (
    <label className={`inline-flex items-center gap-2 text-xs text-text-muted ${className}`}>
      <span className="sr-only">{t('common.language')}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.4 3.75-5.4 3.75-9S14.5 5.4 12 3m0 18c-2.5-2.4-3.75-5.4-3.75-9S9.5 5.4 12 3M3.5 9h17m-17 6h17"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <select
        value={current}
        onChange={(e) => {
          if (isLanguageCode(e.target.value)) void chooseLanguage(e.target.value);
        }}
        className="rounded-md border border-white/10 bg-bg-elevated px-2 py-1 text-xs text-text-secondary focus:outline-none"
        aria-label={t('common.language')}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Applies the restaurant's default language unless this browser has a personal pick. */
export function useOrgDefaultLanguage(orgLanguage: string | null | undefined) {
  useEffect(() => {
    if (hasPersonalLanguage()) return;
    if (isLanguageCode(orgLanguage)) void applyLanguage(orgLanguage);
  }, [orgLanguage]);
}
