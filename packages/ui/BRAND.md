# Cullinos brand strategy

## Surfaces

| Surface | Palette | Type |
|---------|---------|------|
| Admin / Customer web | Gold `#D4A017` on navy `#0F0F1A` | Restaurant ops + outlet ordering |
| Guest Flutter app | Teal / coral (marketplace) | Consumer discovery |
| Super-admin | Neutral gray (`platform.css`) | Platform control plane |

## Shared signals (do not diverge)

- Wordmark: **Cullinos.** (trailing period accent)
- Display font: **Plus Jakarta Sans**
- Body font (web): Inter

## Tenant theming (customer web)

Bootstrap may include:

- `logoUrl` — brand or org logo
- `coverImageUrl` — outlet cover for hero
- `accentColor` — optional `#RRGGBB` from brand settings (`accentColor` / `primaryColor`)

When `accentColor` is set, the customer shell maps it onto `--color-brand-primary`.

## Decision

Keep Guest teal/coral as the **marketplace** brand and web gold/navy as the **ops / storefront** brand. Unify through the shared wordmark and display type rather than forcing one palette everywhere.
