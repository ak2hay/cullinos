# Cullinos Waiter (Android)

Floor staff app for phone and tablet. Replaces the Waiter web portal (`waiter.cullinos.com`).

## Feature checklist

### Web parity
- [x] Email/password login + OTP when required
- [x] Keep signed in / secure token storage
- [x] Outlet picker + remember last outlet
- [x] Live WebSocket (orders, tables, KOTs, service requests)
- [x] Floor table grid by status + section labels + order badge
- [x] Assign table → OCCUPIED
- [x] Table order: stage items → draft → confirm (KOT)
- [x] QR session start / show / copy link / end
- [x] Service calls: acknowledge / resolve
- [x] Table status: Occupied / Billing / Cleaning / Available

### Feature-rich additions
- [x] Variants + modifier groups + line notes + order notes
- [x] Menu search + category chips
- [x] Transfer table / merge tables
- [x] Service request type + age + Open/Acknowledged/All filters
- [x] Phone bottom nav (Floor · Calls · QR · Orders · More) + tablet split floor/detail
- [x] Orders hub for outlet
- [x] Settings: profile, outlet, language, call sound + haptic
- [x] Localization: en, hi, mr, gu, ta, bn, te, kn, ml, pa (English default)
- [x] Call alert sound (WAV) + independent haptic
- [x] Offline connectivity banner
- [x] Collect payment (cash / Razorpay / Cashfree) for unpaid / pay-later guest orders
- [x] Force-update hook via `--dart-define=WAITER_MIN_BUILD=<n>`

### Out of scope (v1)
- Full POS shifts / cash drawer (use POS)
- Admin table CRUD
- Kitchen KOT board (use KDS)

## Future backlog

- Split-bill / partial tender polish
- e-bill SMS/email from waiter
- Print bill via print profiles
- Camera scan of table QR
- Offline order queue
- FCM push for calls
- Tip entry / waiter tips report
- Section assignment
- Urdu / Odia / Assamese locales
- Stricter `payment:collect` API permission

## Flavors

| Flavor | Entry | API default |
|--------|-------|-------------|
| dev | `lib/main_dev.dart` | `http://10.0.2.2:3000/api/v1` |
| staging | `lib/main_staging.dart` | staging API |
| prod | `lib/main_prod.dart` | `https://api.cullinos.com/api/v1` |

```bash
flutter run --flavor prod -t lib/main_prod.dart
# Optional force-update threshold:
flutter run --flavor prod -t lib/main_prod.dart --dart-define=WAITER_MIN_BUILD=2
```

## Package

- Name: `cullinos_waiter`
- applicationId: `com.cullinos.waiter`

## Guest QR / App Links

Table and session QR use `https://guest.cullinos.com/o/{org}/{outlet}?…` (smart landing:
try Guest app → Play/App Store). For verified Android App Links, replace the placeholder
SHA-256 in `infrastructure/www/guest-landing/.well-known/assetlinks.json` with the Play
signing certificate fingerprint and redeploy guest-landing.
