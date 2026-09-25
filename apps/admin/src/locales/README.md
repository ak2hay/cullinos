# Admin portal translations

One `common.json` per language: `en`, `hi`, `mr`, `gu`, `ta`, `bn`, `te`, `kn`, `ml`, `pa`.

- `en` is the source of truth and is bundled; the others are lazy-loaded (`src/i18n.ts`).
- Every locale must have the same keys as `en`. Missing keys fall back to English.
- Non-English files are machine-drafted and **need review by a native speaker** before
  they are promoted to customers.
- Language resolution: a per-browser pick from the language menu wins; otherwise the restaurant
  default (Settings → General → Language, stored as `settings.language`); otherwise English.
- Brand names, GSTIN, UPI, QSR, POS and SMS stay in Latin script.

Adding strings: add the key to `en/common.json` first, then to every other locale, and use
`const { t } = useTranslation()` in the component.
